import { useRef, useState, useSyncExternalStore } from 'react'
import { useIsFocused } from '@react-navigation/native'
import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useDeptPickPending, useOnboardingDone } from '../../lib/onboarding'
import { useAuth } from '../../contexts/AuthContext'
import { usePartnerNoticePending } from '../../components/map/PartnerNoticeModal'
import { setNoticeState, subscribe, noticeState, popupNotice, STORAGE_KEY } from '../../utils/common/launchNoticeModal'

/** LaunchNoticeModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useLaunchNoticeModal() {
  const state = useSyncExternalStore(subscribe, () => noticeState, () => noticeState)
  const focused = useIsFocused()
  const onboardingDone = useOnboardingDone() === true
  // 학과 고르기 화면은 로그인한 경우에만 메인을 가린다(RootNavigator) — 게스트는 표시가 남아 있어도 기다리지 않는다.
  const { status } = useAuth()
  const deptPickShowing = useDeptPickPending() && status === 'authenticated'
  const partnerNoticePending = usePartnerNoticePending()
  const [detailOpen, setDetailOpen] = useState(false)

  /** 이번 실행에서만 닫는다. */
  const closeForNow = () => setNoticeState('seen')

  /** 이 공지는 다시 띄우지 않는다. */
  const dontShowAgain = () => {
    setNoticeState('seen')
    if (popupNotice) AsyncStorage.setItem(STORAGE_KEY, popupNotice.id).catch(() => {})
  }

  // '보러가기'는 팝업 창을 닫고 본문 창을 새로 띄우지 않고, 같은 창 안에서 본문으로 바꿔 보여 준다. iOS 에서 창이 닫히는
  // 중에 다른 창을 띄우면 안 뜨고 화면이 멈출 수 있다(11-06 설정 공지 목록에서 실제로 멈췄다). 본문을 닫으면 이번 실행에서만 닫힌다.
  const openDetail = () => setDetailOpen(true)
  const closeDetail = () => {
    setDetailOpen(false)
    closeForNow()
  }

  const popup = popupNotice?.popup
  const showPopup = state === 'pending' && popup !== undefined && focused && onboardingDone && !deptPickShowing && !partnerNoticePending

  // 카드 폭은 화면마다 달라(폴드·웹 창) 그려진 뒤 잰다. 넘긴 위치로 지금 카드를 고른다.
  const pagerRef = useRef<ScrollView>(null)
  const [pageWidth, setPageWidth] = useState(0)
  const [page, setPage] = useState(0)
  const lastPage = (popup?.slides.length ?? 1) - 1

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth === 0) return
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth)
    if (next !== page) setPage(Math.max(0, Math.min(lastPage, next)))
  }

  const goNext = () => {
    if (page >= lastPage) {
      closeForNow()
      return
    }
    pagerRef.current?.scrollTo({ x: (page + 1) * pageWidth, animated: true })
    setPage(page + 1)
  }
  return {
    detailOpen,
    closeForNow,
    dontShowAgain,
    openDetail,
    closeDetail,
    popup,
    showPopup,
    pagerRef,
    pageWidth,
    setPageWidth,
    page,
    lastPage,
    handleScroll,
    goNext,
  }
}
