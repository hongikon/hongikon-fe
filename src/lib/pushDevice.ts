import AsyncStorage from '@react-native-async-storage/async-storage'
import { deactivateDevice, registerDevice, type DevicePlatform } from '../apis/devices'
import { ApiError, isRetryableError } from '../apis/client'

/**
 * 서버에 등록한 이 기기의 id(`POST /users/me/devices` 응답). 알림을 끄거나 로그아웃할 때
 * `DELETE /users/me/devices/{id}` 로 비활성화하려면 id 가 필요해 남겨 둔다.
 * 비밀 값이 아니라 SecureStore 대신 AsyncStorage 에 둔다(웹에서도 그대로 동작).
 */
const DEVICE_ID_KEY = '@hongikon_push_device_id'

async function getStoredDeviceId(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_ID_KEY)
    const id = raw ? Number(raw) : NaN
    return Number.isInteger(id) && id > 0 ? id : null
  } catch (error) {
    if (__DEV__) console.warn('저장된 기기 id 를 읽지 못했습니다:', error)
    return null
  }
}

async function setStoredDeviceId(id: number | null): Promise<void> {
  try {
    if (id === null) await AsyncStorage.removeItem(DEVICE_ID_KEY)
    else await AsyncStorage.setItem(DEVICE_ID_KEY, String(id))
  } catch (error) {
    if (__DEV__) console.warn('기기 id 를 저장하지 못했습니다:', error)
  }
}

/**
 * 등록·비활성화를 한 줄로 세운다. 알림을 켰다 바로 끄면 등록 응답(새 id)이 오기 전에 비활성화가
 * 먼저 돌아 "저장된 id 없음"으로 지나가고, 뒤늦게 온 등록이 기기를 다시 살려 둔다 — 순서대로 돌려 막는다.
 */
let queue: Promise<unknown> = Promise.resolve()
function runSerially<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task)
  queue = next.catch(() => {})
  return next
}

/**
 * 등록을 부른 횟수(부르는 순간 센다)와, 지금 저장된 id 를 쓴 등록의 번호. 로그아웃이 시작할 때 센 값
 * (`pushRegistrationMark`)과 견줘 "로그아웃 뒤에 부른 등록(= 다음 계정)이 쓴 id 인지" 가린다.
 * 서버는 같은 푸시 토큰 재등록을 기존 행을 새 계정으로 넘겨 처리해 id 가 같을 수 있어, id 값으로는 못 가린다.
 * 메모리에만 둔다 — 앱을 다시 켜면 로그아웃 뒤 등록이 있을 수 없어 0 이어도 된다.
 */
let registerCalls = 0
let storedBy = 0

/** 지금까지 부른 등록 번호. 로그아웃·만료 정리가 시작할 때 받아 `deactivateStoredPushDevice` 의 `before` 로 넘긴다. */
export function pushRegistrationMark(): number {
  return registerCalls
}

/** 기기를 등록하고 받은 id 를 저장한다. 실패하면 던진다(재시도 판단은 호출부가 한다). */
export function registerPushDevice(
  pushToken: string,
  platform: DevicePlatform,
  accessToken: string,
): Promise<void> {
  const seq = ++registerCalls
  return runSerially(async () => {
    const device = await registerDevice(pushToken, 'EXPO', platform, accessToken)
    await setStoredDeviceId(device.id)
    storedBy = seq
  })
}

/**
 * 저장된 기기를 서버에서 비활성화한다. 저장된 id 가 없으면 할 일이 없다.
 * 서버가 거절한 경우(404 이미 없음, 403 다른 계정 소유 등)는 다시 보내도 같아 id 를 지운다.
 *
 * - quick: 로그아웃 — 끊긴 망에서 재시도·백오프로 몇십 초 끌지 않게 한 번만, 짧게 보낸다. 이미 로컬
 *   로그아웃이 끝난 뒤라 앱 전역의 자동 재발급도 쓰지 않는다.
 * - reissue: 401(액세스 토큰 만료·없음)이면 한 번 불러 새 토큰으로 다시 보낸다. 로그아웃처럼 저장소의
 *   토큰을 이미 지워 전역 재발급을 쓸 수 없는 곳에서 미리 꺼내 둔 refresh 토큰으로 받는다.
 * - before: 로그아웃 시작 때 받은 `pushRegistrationMark()`. 저장된 id 를 그 뒤에 부른 등록(곧바로 다시 로그인한
 *   다음 계정)이 썼으면 건드리지 않는다 — 이전 계정 토큰으로 보내 봐야 거절되고, 아래 forget 이 새 계정의 id 를
 *   지워 그 계정이 알림 끄기·로그아웃 때 기기를 못 내린다(푸시가 계속 온다).
 * - forget: 결과와 상관없이 같은 작업 안에서 저장된 id 를 지운다(로그아웃 마무리). 따로 줄을 세우면 비활성화와
 *   지우기 사이에 다음 계정의 등록이 끼어들어 방금 저장한 새 id 를 지운다.
 *
 * @returns 연결 문제로 실패해 나중에 다시 시도해야 하면 false.
 */
export function deactivateStoredPushDevice(
  accessToken: string | null,
  options: { quick?: boolean; reissue?: () => Promise<string | null>; before?: number; forget?: boolean } = {},
): Promise<boolean> {
  const { quick = false, reissue, before, forget = false } = options
  return runSerially(async () => {
    if (before !== undefined && storedBy > before) return true
    try {
      return await deactivateNow(accessToken, quick, reissue)
    } finally {
      if (forget) await setStoredDeviceId(null)
    }
  })
}

/** `deactivateStoredPushDevice` 의 본체. 줄(runSerially) 안에서만 부른다. */
async function deactivateNow(
  accessToken: string | null,
  quick: boolean,
  reissue: (() => Promise<string | null>) | undefined,
): Promise<boolean> {
  const id = await getStoredDeviceId()
  if (id === null) return true
  const send = (token: string) =>
    deactivateDevice(id, token, quick ? { retries: 0, timeoutMs: 5_000, skipTokenRefresh: true } : {})
  try {
    const token = accessToken ?? (await reissue?.()) ?? null
    if (!token) return false
    try {
      await send(token)
    } catch (error) {
      if (!reissue || !(error instanceof ApiError) || error.status !== 401) throw error
      const fresh = await reissue()
      if (!fresh) throw error
      await send(fresh)
    }
  } catch (error) {
    if (isRetryableError(error) || !(error instanceof ApiError)) {
      if (__DEV__) console.warn('기기 비활성화에 실패했습니다(나중에 다시 시도):', error)
      return false
    }
    if (__DEV__) console.warn('서버가 기기 비활성화를 거절해 저장된 id 를 지웁니다:', error)
  }
  await setStoredDeviceId(null)
  return true
}

/**
 * 서버에 알리지 않고 저장된 id 만 지운다(회원 탈퇴 — 서버가 기기 행을 이미 지운다). 로그아웃 마무리는
 * `deactivateStoredPushDevice` 의 forget 을 쓴다(따로 부르면 다음 계정의 id 를 지울 수 있다).
 */
export function forgetStoredPushDevice(): Promise<void> {
  return runSerially(() => setStoredDeviceId(null))
}
