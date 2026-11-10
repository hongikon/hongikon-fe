import AsyncStorage from '@react-native-async-storage/async-storage'
import { nearbyDevTools } from './debug'

/**
 * 근처 알림 판단 기록(11-10 사용자 요청: "왜 오래 있어도 안 오고 지나가기만 해도 오는지" 현장에서 확인할 수 있게).
 * 테스트 빌드·관리자 계정에서만 남기고, 일반 사용자는 아무것도 남기지 않는다(`nearbyDevTools`).
 *
 * 남기는 것: 시각, 위치 종류(GPS·Wi-Fi)와 오차, 가장 가까운 가게 이름과 거리, 들어옴·나감, 알림 예약·취소, 보내지 않은 이유,
 * 운영체제 원 신호. 좌표(위도·경도)는 남기지 않는다. 기기에만 두고 서버로 보내지 않으며, 설정 화면에서 지울 수 있다.
 */

const KEY = 'hongikon_nearby_log_v1'
/** 이만큼만 두고 오래된 줄부터 버린다. 위치 줄은 바뀐 게 있거나 30초마다만 남겨 몇 시간치가 남게 한다(background). */
const MAX_LINES = 400

export interface NearbyLogLine {
  at: number
  text: string
}

let lines: NearbyLogLine[] | null = null
let chain: Promise<unknown> = Promise.resolve()

async function load(): Promise<NearbyLogLine[]> {
  if (lines) return lines
  try {
    const raw = await AsyncStorage.getItem(KEY)
    lines = raw ? (JSON.parse(raw) as NearbyLogLine[]) : []
  } catch {
    lines = []
  }
  return lines
}

/** 한 줄 남긴다(도구를 못 쓰는 계정이면 아무것도 하지 않는다). 저장은 차례로 한다. */
export function nearbyLog(text: string, at: number = Date.now()): Promise<void> {
  if (!nearbyDevTools()) return Promise.resolve()
  const job = chain.then(async () => {
    const all = await load()
    all.push({ at, text })
    if (all.length > MAX_LINES) all.splice(0, all.length - MAX_LINES)
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(all))
    } catch {
      // 못 남겨도 알림 판단에는 영향이 없다.
    }
  })
  chain = job.catch(() => {})
  return job
}

/** 최근 기록(새것이 위). */
export async function readNearbyLog(): Promise<NearbyLogLine[]> {
  await chain
  lines = null // 백그라운드 작업이 다른 실행에서 남긴 줄도 읽게 다시 읽는다.
  return [...(await load())].reverse()
}

export async function clearNearbyLog(): Promise<void> {
  await chain
  lines = []
  try {
    await AsyncStorage.removeItem(KEY)
  } catch {
    // 무시
  }
}

/** 한국 시간 HH:MM:SS. */
export function logClock(ms: number): string {
  const d = new Date(ms + 9 * 60 * 60 * 1000)
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}
