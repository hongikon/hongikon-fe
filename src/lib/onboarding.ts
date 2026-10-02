import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * 첫 실행 온보딩(소개 → 내 학과 고르기 → 앱 접근권한 안내 → 알림 허용)을 마쳤는지 앱 전체가 함께 본다.
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

let initPromise: Promise<void> | null = null

/**
 * 온보딩을 보여줄지 정한다. 앱 실행마다 한 번, 로그인 상태 복원이 끝난 뒤·SettingsProvider 가
 * 설정을 저장하기 전에 불러야 한다(`OnboardingGate`) — 그래야 저장된 설정 유무로 예전 사용자를 가려낼 수 있다.
 *
 * 예전 사용자(로그인·게스트 상태이거나, 저장된 설정·알림 질문 기록이 있음)는 온보딩 없이 바로 끝냄 처리한다.
 * 업데이트 직후 이미 쓰던 앱에 갑자기 소개 화면이 뜨면 안 되기 때문이다.
 */
export function initOnboarding(hasSession: boolean): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_KEY)
        if (stored === '1') return set('done')
        if (stored === 'pending') return set('pending')

        const [settings, asked] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(NOTIFICATION_ASKED_KEY),
        ])
        if (hasSession || settings !== null || asked !== null) {
          await AsyncStorage.setItem(ONBOARDING_KEY, '1')
          return set('done')
        }

        await AsyncStorage.setItem(ONBOARDING_KEY, 'pending')
        set('pending')
      } catch (error) {
        // 저장소를 못 읽으면 끝냄으로 둔다 — 끝낸 기록도 못 남겨 매번 온보딩이 뜨는 것보다 낫다.
        if (__DEV__) console.warn('온보딩 상태를 불러오지 못해 건너뜁니다:', error)
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
 * 온보딩을 다시 보게 한다(설정의 "온보딩 다시 보기" 같은 곳에서 부른다).
 * 부르는 즉시 RootNavigator 가 온보딩 화면으로 바꾼다 — 로그인·게스트 상태여도 보여주고,
 * 끝내면 원래 화면(메인)으로 돌아간다. 구독한 학과는 지우지 않는다.
 */
export async function resetOnboarding(): Promise<void> {
  set('pending')
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'pending')
  } catch (error) {
    if (__DEV__) console.warn('온보딩 상태를 저장하지 못했습니다:', error)
  }
}
