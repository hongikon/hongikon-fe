import { useRef, useState, useSyncExternalStore } from 'react'
import { useIsFocused } from '@react-navigation/native'
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { DIALOG_MAX_WIDTH } from '../../constants/layout'
import { RADIUS } from '../../constants/spacing'
import { APP_NOTICES, type AppNotice } from '../../constants/appNotices'
import { kstTodayYmd } from '../../utils/exhibitions'
import { useDeptPickPending, useOnboardingDone } from '../../lib/onboarding'
import { useAuth } from '../../contexts/AuthContext'
import { usePartnerNoticePending } from '../map/PartnerNoticeModal'
import NoticeDetailModal from '../settings/NoticeDetailModal'
import Button from './Button'

/** 마지막으로 닫은 팝업 공지 id. 새 팝업 공지(id 가 다름)가 생기면 다시 뜬다. */
const STORAGE_KEY = '@hongikon_launch_notice_seen'

/** 팝업이 사라지는 애니메이션이 끝난 뒤 본문 화면을 연다 — 네이티브 Modal 이 닫히는 중에 다른 Modal 을 열면 안 뜰 수 있다. */
const DETAIL_OPEN_DELAY_MS = 350

/** 지금 띄울 공지 — 최신순 목록에서 popup.until(KST, 그날까지)이 지나지 않은 첫 공지. */
export function currentPopupNotice(notices: AppNotice[] = APP_NOTICES, now: number = Date.now()): AppNotice | null {
  const today = kstTodayYmd(now)
  return notices.find((notice) => notice.popup !== undefined && today <= notice.popup.until) ?? null
}

/**
 * 띄울 차례인지. PartnerNoticeModal 과 같은 방식으로 앱 전체가 함께 본다 — 알림 안내(NotificationPrimer)가 이 창이
 * 닫힐 때까지 기다린다(네이티브 Modal 두 개가 겹치면 화면이 눌리지 않았다, PartnerNoticeModal 주석).
 * 'unknown' = 저장소를 아직 안 읽음, 'pending' = 띄울 차례, 'seen' = 봤음·띄울 공지 없음·못 읽어 건너뜀.
 */
type LaunchNoticeState = 'unknown' | 'pending' | 'seen'
const popupNotice = currentPopupNotice()
let noticeState: LaunchNoticeState = popupNotice ? 'unknown' : 'seen'
let loading = false
const listeners = new Set<() => void>()

function setNoticeState(next: LaunchNoticeState): void {
  if (noticeState === next) return
  noticeState = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!loading && popupNotice) {
    loading = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((seenId) => setNoticeState(seenId === popupNotice.id ? 'seen' : 'pending'))
      .catch(() => setNoticeState('seen'))
  }
  return () => {
    listeners.delete(listener)
  }
}

/** 앱 공지 팝업이 아직 닫히지 않았는지(판단 전 포함). 다른 첫 실행 안내 창은 이게 false 가 된 뒤에 띄운다. */
export function useLaunchNoticePending(): boolean {
  return useSyncExternalStore(subscribe, () => noticeState, () => noticeState) !== 'seen'
}

/**
 * 앱을 켜고 지도에 들어왔을 때 한 번 뜨는 공지 카드(11-02 처리방침 변경 안내부터). appNotices.ts 에서 popup 을 준 공지만
 * 띄운다. 카드는 옆으로 넘기거나 '다음'으로 넘기고, 마지막 카드의 확인이나 '보러가기'를 누르면 그 id 를 남겨 다시 뜨지 않는다. '보러가기'는 같은 공지 본문(설정 > 공지사항과 같은
 * 화면)을 연다 — 바뀐 처리방침 전문은 적용일부터 앱에 실린다.
 * 첫 실행 화면(온보딩·학과 고르기)과 제휴 안내가 끝난 뒤에 띄운다.
 */
export default function LaunchNoticeModal() {
  const state = useSyncExternalStore(subscribe, () => noticeState, () => noticeState)
  const focused = useIsFocused()
  const onboardingDone = useOnboardingDone() === true
  // 학과 고르기 화면은 로그인한 경우에만 메인을 가린다(RootNavigator) — 게스트는 표시가 남아 있어도 기다리지 않는다.
  const { status } = useAuth()
  const deptPickShowing = useDeptPickPending() && status === 'authenticated'
  const partnerNoticePending = usePartnerNoticePending()
  const [detailOpen, setDetailOpen] = useState(false)

  const markSeen = () => {
    setNoticeState('seen')
    if (popupNotice) AsyncStorage.setItem(STORAGE_KEY, popupNotice.id).catch(() => {})
  }

  const openDetail = () => {
    markSeen()
    setTimeout(() => setDetailOpen(true), DETAIL_OPEN_DELAY_MS)
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
      markSeen()
      return
    }
    pagerRef.current?.scrollTo({ x: (page + 1) * pageWidth, animated: true })
    setPage(page + 1)
  }

  return (
    <>
      {showPopup && (
        <Modal visible transparent animationType="fade" onRequestClose={markSeen}>
          <View style={styles.backdrop}>
            <View style={styles.card}>
              <Pressable onPress={markSeen} accessibilityRole="button" accessibilityLabel="공지 닫기" hitSlop={10} style={styles.close}>
                <Ionicons name="close" size={20} color={COLORS.textTertiary} />
              </Pressable>
              <ScrollView
                ref={pagerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                {popup.slides.map((slide, index) => (
                  <View key={slide.title} style={[styles.slide, { width: pageWidth || undefined }]}>
                    <View style={styles.art}>
                      <View style={styles.artRing}>
                        <View style={styles.artCircle}>
                          <Ionicons name={slide.icon} size={44} color={COLORS.white} />
                        </View>
                      </View>
                      {slide.badge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{slide.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.title}>{slide.title}</Text>
                    <Text style={styles.text}>{slide.text}</Text>
                    {index === lastPage && (
                      <Pressable onPress={openDetail} accessibilityRole="link" hitSlop={8} style={styles.link}>
                        <Text style={styles.linkText}>{popup.linkLabel}</Text>
                        <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>
              <View style={styles.dots} accessibilityLabel={`${popup.slides.length}장 중 ${page + 1}장`}>
                {popup.slides.map((slide, index) => (
                  <View key={slide.title} style={[styles.dot, index === page && styles.dotActive]} />
                ))}
              </View>
              <View style={styles.action}>
                <Button label={page >= lastPage ? '확인했어요' : '다음'} onPress={goNext} size="md" />
              </View>
            </View>
          </View>
        </Modal>
      )}
      <NoticeDetailModal visible={detailOpen} notice={popupNotice} onClose={() => setDetailOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.scrim,
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: DIALOG_MAX_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingTop: 16,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  close: { position: 'absolute', top: 12, right: 12, zIndex: 1, padding: 4 },
  slide: { paddingHorizontal: 20, alignItems: 'center' },
  // 그림 칸 — 그림 파일이 생기면 이 자리에 Image 로 바꾼다.
  art: {
    alignSelf: 'stretch',
    height: 168,
    marginTop: 20,
    marginBottom: 18,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.white,
  },
  badgeText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.primary },
  title: { fontSize: 18, fontFamily: FONTS.semibold, color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  text: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.textSecondary, textAlign: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 8, marginTop: 6 },
  linkText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.primary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { width: 18, backgroundColor: COLORS.primary },
  action: { paddingHorizontal: 20 },
})
