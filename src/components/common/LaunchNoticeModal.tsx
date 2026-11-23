import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { DIALOG_MAX_WIDTH } from '../../constants/layout'
import { RADIUS } from '../../constants/spacing'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { NoticeDetailContent } from '../settings/NoticeDetailModal'
import ModalHeader from '../settings/ModalHeader'
import ContentColumn from './ContentColumn'
import Button from './Button'
import { useLaunchNoticeModal } from '../../hooks/common/useLaunchNoticeModal'
import { popupNotice } from '../../utils/common/launchNoticeModal'

/**
 * 앱을 켜고 지도에 들어왔을 때 한 번 뜨는 공지 카드(11-02 처리방침 변경 안내부터). appNotices.ts 에서 popup 을 준 공지만
 * 띄운다. 카드는 옆으로 넘기거나 '다음'으로 넘긴다. 닫는 방법은 둘 — '닫기'(X·뒤로 가기·마지막 카드 버튼·'보러가기' 포함)는
 * 이번 실행에서만 닫아 다음에 앱을 켜면 다시 뜨고, '다시 보지 않기'는 그 id 를 남겨 더는 뜨지 않는다(popup.until 이 지나도 안 뜬다).
 * '보러가기'는 같은 공지 본문(설정 > 공지사항과 같은 화면)을 연다.
 * 첫 실행 화면(온보딩·학과 고르기)과 제휴 안내가 끝난 뒤에 띄운다.
 */
export default function LaunchNoticeModal() {
  const { detailOpen, closeForNow, dontShowAgain, openDetail, closeDetail, popup, showPopup, pagerRef, pageWidth, setPageWidth, page, lastPage, handleScroll, goNext } = useLaunchNoticeModal()

  return (
    <>
      {showPopup && popup && (
        <Modal visible transparent animationType="fade" onRequestClose={detailOpen ? closeDetail : closeForNow}>
          {detailOpen && popupNotice ? (
            <SafeAreaProvider>
              <SafeAreaView style={styles.detail} edges={['top']}>
                <ContentColumn>
                  <ModalHeader title="공지사항" onClose={closeDetail} />
                  <NoticeDetailContent notice={popupNotice} />
                </ContentColumn>
              </SafeAreaView>
            </SafeAreaProvider>
          ) : (
          <View style={styles.backdrop}>
            <View style={styles.card}>
              <Pressable onPress={closeForNow} accessibilityRole="button" accessibilityLabel="공지 닫기" hitSlop={10} style={styles.close}>
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
              <View style={styles.actions}>
                <Button label="다시 보지 않기" variant="outline" onPress={dontShowAgain} size="md" style={styles.actionButton} />
                <Button label={page >= lastPage ? '닫기' : '다음'} onPress={goNext} size="md" style={styles.actionButton} />
              </View>
            </View>
          </View>
          )}
        </Modal>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  detail: { flex: 1, backgroundColor: COLORS.background },
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
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  actionButton: { flex: 1 },
})
