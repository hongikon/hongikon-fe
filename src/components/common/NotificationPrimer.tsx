import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Platform, StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import NotificationStep from '../onboarding/NotificationStep'
import { COLORS } from '../../constants/colors'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  refreshNotificationPermission,
} from '../../lib/notificationPermission'
import { useAuth } from '../../contexts/AuthContext'
import { useDeptPickPending, useOnboardingDone } from '../../lib/onboarding'

/** 최초 실행 때 한 번 물었는지. 한 번 물은 뒤엔 다시 자동으로 띄우지 않는다(설정 화면에서 켤 수 있다). */
const ASKED_KEY = '@hongikon_notification_permission_asked'

/**
 * 첫 실행 온보딩의 알림 단계가 화면에 나오면 부른다. 그 단계가 허용 창을 맡으므로
 * 온보딩이 끝난 뒤 NotificationPrimer 가 같은 걸 또 묻지 않게 물었다고 기록해 둔다.
 */
export async function markNotificationPermissionAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, '1')
  } catch {
    // 못 남겨도 NotificationPrimer 는 권한이 이미 정해졌으면(허용·거절) 묻지 않는다.
  }
}

/** 로그인 직후(또는 학과 고르기를 끝낸 직후) 화면이 바뀐 뒤에 띄우려고 잠깐 기다린다. */
const FIRST_LAUNCH_DELAY_MS = 800

/**
 * 로그인한 뒤 한 번 시스템 알림 허용 창을 띄운다(iOS·Android). 알림은 로그인한 계정 기준이라
 * 앱을 처음 켰을 때나 둘러보기(게스트) 중에는 묻지 않는다(10-02 결정).
 * 한 번 물은 뒤엔(허용·거절과 무관) 다시 자동으로 띄우지 않는다 — 설정 > 알림에서 "설정 열기"로 바꿀 수 있다.
 * 흐름: 앱 소개 → (로그인 또는 둘러보기) → 내 학과 고르기(처음 켠 기기만) → 로그인했으면 알림 안내 화면(NotificationStep)
 * → "알림 받기"를 누를 때만 시스템 허용 창.
 * 온보딩(다시 보기 포함)이나 학과 고르기가 남아 있으면 그게 끝날 때까지 기다린다 — 안내는 전체 화면 Modal 이라
 * 그대로 띄우면 학과 고르기를 덮는다. 끝나면 `ready` 가 true 로 바뀌며 아래 효과가 그때 한 번 돈다.
 * 둘러보기(게스트)면 안내 없이 넘어간다. 허용되면 기기 등록이 바로 이어진다(usePushNotifications).
 */
export default function NotificationPrimer() {
  const startedRef = useRef(false)
  const { status } = useAuth()
  const loggedIn = status === 'authenticated'
  const onboardingDone = useOnboardingDone() === true
  const deptPickPending = useDeptPickPending()
  /** 첫 실행 화면들(온보딩·학과 고르기)을 다 지나 메인에 들어왔는지. */
  const ready = onboardingDone && !deptPickPending
  // 로그인한 뒤 처음 한 번, 시스템 창 전에 앱이 이유를 먼저 보여 주는 안내 화면(NotificationStep).
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'web' || !loggedIn || !ready || startedRef.current) return
    startedRef.current = true

    let cancelled = false
    let fired = false
    const timer = setTimeout(async () => {
      fired = true
      try {
        if ((await AsyncStorage.getItem(ASKED_KEY)) === '1' || cancelled) return
        const permission = await refreshNotificationPermission()
        // 이미 허용했거나(다른 경로로) 더는 물을 수 없으면 안내 없이 기록만 남긴다.
        if (permission.status === 'undetermined' && permission.canAskAgain && !cancelled) {
          setShowGuide(true)
          return
        }
        await AsyncStorage.setItem(ASKED_KEY, '1')
      } catch {
        // 저장소·권한 조회 실패는 무시한다 — 다음 실행 때 다시 시도된다.
      }
    }, FIRST_LAUNCH_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
      // 기다리는 사이 조건이 풀리면(학과 고르기·온보딩 다시 보기 등) 아직 묻지 않은 것이니 다음에 다시 판단한다.
      if (!fired) startedRef.current = false
    }
  }, [loggedIn, ready])

  // 로그아웃하면 안내를 거두고, 다음 로그인 때 다시 판단한다.
  useEffect(() => {
    if (!loggedIn) {
      setShowGuide(false)
      startedRef.current = false
    }
  }, [loggedIn])

  const handleDone = useCallback(() => {
    setShowGuide(false)
    void markNotificationPermissionAsked()
  }, [])

  if (!showGuide) return null
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={handleDone}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.guide} edges={['top', 'bottom']}>
          <NotificationStep onDone={handleDone} />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  guide: { flex: 1, backgroundColor: COLORS.white, paddingHorizontal: 24 },
})
