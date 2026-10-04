import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * 첫 실행 온보딩(소개 → 앱 접근권한 안내)을 마쳤는지, 그 뒤 "내 학과 고르기"가 남았는지 앱 전체가 함께 본다.
 *
 * 첫 실행 흐름(10-04 변경): 소개 → 접근권한 안내(네이티브만) → 웰컴(로그인/둘러보기) → 내 학과 고르기 → 메인
 * → (로그인했으면) 알림 안내. 학과 고르기를 로그인 뒤로 옮긴 건, 로그인한 사용자는 고른 구독이 곧바로 계정(서버)에
 * 저장되고, 다른 기기에서 이미 구독해 둔 계정이면 고를 필요 없이 건너뛸 수 있게 하려는 것이다.
 * 접근권한 안내는 정보통신망법 제22조의2의 "앱 최초 실행 시" 고지라 로그인 앞에 그대로 둔다.
 *
 * 저장값(`@hongikon_onboarding_done`)
 * - '1': 끝냄(또는 이 기능이 생기기 전부터 쓰던 사용자라 조용히 끝냄 처리)
 * - 'pending': 보여주기로 정했지만 아직 끝내지 않음. 중간에 앱을 꺼도 다음 실행 때 이어서 보여준다.
 *   이 값이 없으면 첫 실행 때 저장된 설정(`@hongik_settings`)만 보고 "예전 사용자"로 잘못 판단한다.
 * - 없음: 이번이 이 기능을 처음 만나는 실행. `initOnboarding` 이 판단한다.
 *
 * 웹도 같은 키를 쓴다(AsyncStorage → localStorage).
 */
const ONBOARDING_KEY = '@hongikon_onboarding_done'
/** SettingsContext 의 저장 키. 한 번이라도 앱을 켰으면 생긴다(설정을 불러온 직후 저장한다). */
const SETTINGS_KEY = '@hongik_settings'
/** NotificationPrimer 가 남기는 키. 있으면 이전 버전에서 앱을 켠 적이 있다. */
const NOTIFICATION_ASKED_KEY = '@hongikon_notification_permission_asked'
/**
 * "내 학과 고르기"가 남았는지. '1' 이면 남음, 없으면(또는 '0') 끝냄.
 * 처음 켠 기기에서 온보딩을 보여주기로 정할 때만 '1' 로 두므로, 예전 사용자(온보딩 '1')는 키가 없어 보지 않는다.
 * 웰컴을 지나(로그인·게스트) 메인으로 들어가기 직전에 RootNavigator 가 보여 주고, 고르거나 "나중에"를 누르면 지운다.
 */
const DEPT_PICK_KEY = '@hongikon_dept_pick_pending'

type OnboardingState = 'unknown' | 'pending' | 'done'

let current: OnboardingState = 'unknown'
const listeners = new Set<() => void>()

function set(next: OnboardingState): void {
  if (current === next) return
  current = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 학과 고르기가 남았는지. 온보딩 상태와 같은 방식으로 앱 전체가 본다(판단 전에는 false). */
let deptPickPending = false
const deptPickListeners = new Set<() => void>()

function setDeptPick(next: boolean): void {
  if (deptPickPending === next) return
  deptPickPending = next
  deptPickListeners.forEach((listener) => listener())
}

function subscribeDeptPick(listener: () => void): () => void {
  deptPickListeners.add(listener)
  return () => {
    deptPickListeners.delete(listener)
  }
}

let initPromise: Promise<void> | null = null

/**
 * 온보딩을 보여줄지 정한다. 앱 실행마다 한 번, 로그인 상태 복원이 끝난 뒤·SettingsProvider 가
 * 설정을 저장하기 전에 불러야 한다(`OnboardingGate`) — 그래야 저장된 설정 유무로 예전 사용자를 가려낼 수 있다.
 *
 * 예전 사용자(로그인·게스트 상태이거나, 저장된 설정·알림 질문 기록이 있음)는 온보딩 없이 바로 끝냄 처리한다.
 * 업데이트 직후 이미 쓰던 앱에 갑자기 소개 화면이 뜨면 안 되기 때문이다. 학과 고르기도 이들에겐 띄우지 않는다.
 *
 * 학과 고르기 상태는 온보딩 상태보다 먼저 정한다 — OnboardingGate 가 온보딩 상태만 기다렸다가 RootNavigator 를 그리므로,
 * 첫 렌더부터 두 값이 맞아 있어야 메인이 한 프레임 비쳤다가 학과 고르기로 바뀌지 않는다.
 */
export function initOnboarding(hasSession: boolean): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const [stored, deptPick] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(DEPT_PICK_KEY),
        ])
        if (stored === '1') {
          setDeptPick(deptPick === '1')
          return set('done')
        }
        if (stored === 'pending') {
          // 온보딩을 하다 만 기기(이전 버전에서 학과 단계까지 갔던 기기 포함)도 새 흐름대로 로그인 뒤에 고르게 한다.
          // 그때 이미 골라 둔 학과가 있으면 학과 고르기 화면이 알아서 건너뛴다(`DeptPickScreen`).
          if (deptPick !== '1') await AsyncStorage.setItem(DEPT_PICK_KEY, '1')
          setDeptPick(true)
          return set('pending')
        }

        const [settings, asked] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(NOTIFICATION_ASKED_KEY),
        ])
        if (hasSession || settings !== null || asked !== null) {
          await AsyncStorage.setItem(ONBOARDING_KEY, '1')
          return set('done')
        }

        await AsyncStorage.multiSet([
          [DEPT_PICK_KEY, '1'],
          [ONBOARDING_KEY, 'pending'],
        ])
        setDeptPick(true)
        set('pending')
      } catch (error) {
        // 저장소를 못 읽으면 끝냄으로 둔다 — 끝낸 기록도 못 남겨 매번 온보딩이 뜨는 것보다 낫다.
        if (__DEV__) console.warn('온보딩 상태를 불러오지 못해 건너뜁니다:', error)
        setDeptPick(false)
        set('done')
      }
    })()
  }
  return initPromise
}

/** 온보딩을 끝냈는지. 아직 판단 전이면 null. */
export function useOnboardingDone(): boolean | null {
  const state = useSyncExternalStore(subscribe, () => current, () => current)
  return state === 'unknown' ? null : state === 'done'
}

/** 온보딩을 끝낸다. 화면은 바로 바꾸고 저장은 뒤따른다. */
export async function completeOnboarding(): Promise<void> {
  set('done')
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1')
  } catch (error) {
    if (__DEV__) console.warn('온보딩 완료를 저장하지 못했습니다:', error)
  }
}

/**
 * "내 학과 고르기"가 남았는지. 남았으면 RootNavigator 가 메인 대신 학과 고르기를 보여 주고,
 * NotificationPrimer 는 끝날 때까지 알림 안내를 미룬다(안내가 학과 고르기 위에 덮이지 않게).
 */
export function useDeptPickPending(): boolean {
  return useSyncExternalStore(subscribeDeptPick, () => deptPickPending, () => deptPickPending)
}

/** 학과 고르기를 끝낸다(골랐든 "나중에"든, 이미 구독이 있어 건너뛰었든). 화면은 바로 바꾸고 저장은 뒤따른다. */
export async function completeDeptPick(): Promise<void> {
  setDeptPick(false)
  try {
    await AsyncStorage.removeItem(DEPT_PICK_KEY)
  } catch (error) {
    if (__DEV__) console.warn('학과 고르기 완료를 저장하지 못했습니다:', error)
  }
}

/**
 * 온보딩을 다시 보게 한다(설정의 "온보딩 다시 보기" 같은 곳에서 부른다).
 * 부르는 즉시 RootNavigator 가 온보딩 화면으로 바꾼다 — 로그인·게스트 상태여도 보여주고,
 * 끝내면 학과 고르기를 거쳐 원래 화면(메인)으로 돌아간다. 구독한 학과는 지우지 않는다 —
 * 이미 구독이 있으면 학과 고르기는 알아서 건너뛴다.
 */
export async function resetOnboarding(): Promise<void> {
  setDeptPick(true)
  set('pending')
  try {
    await AsyncStorage.multiSet([
      [DEPT_PICK_KEY, '1'],
      [ONBOARDING_KEY, 'pending'],
    ])
  } catch (error) {
    if (__DEV__) console.warn('온보딩 상태를 저장하지 못했습니다:', error)
  }
}
