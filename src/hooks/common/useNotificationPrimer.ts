import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { refreshNotificationPermission } from '../../lib/notificationPermission'
import { useAuth } from '../../contexts/AuthContext'
import { useDeptPickPending, useOnboardingDone } from '../../lib/onboarding'
import { usePartnerNoticePending } from '../../components/map/PartnerNoticeModal'
import { useLaunchNoticePending } from './useLaunchNoticePending'
import { markNotificationPermissionAsked, ASKED_KEY, FIRST_LAUNCH_DELAY_MS } from '../../utils/common/notificationPrimer'

/** NotificationPrimer 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNotificationPrimer() {
  const startedRef = useRef(false)
  const { status } = useAuth()
  const loggedIn = status === 'authenticated'
  const onboardingDone = useOnboardingDone() === true
  const deptPickPending = useDeptPickPending()
  // 지도의 제휴 안내(첫 실행 한 번)가 닫힌 뒤에 띄운다 — 두 Modal 이 겹치면 화면이 눌리지 않았다(PartnerNoticeModal 주석).
  const partnerNoticePending = usePartnerNoticePending()
  // 앱 공지 팝업(LaunchNoticeModal)도 같은 이유로 닫힌 뒤에.
  const launchNoticePending = useLaunchNoticePending()
  /** 첫 실행 화면들(온보딩·학과 고르기·제휴 안내·앱 공지)을 다 지나 메인에 들어왔는지. */
  const ready = onboardingDone && !deptPickPending && !partnerNoticePending && !launchNoticePending
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
  return { showGuide, handleDone }
}
