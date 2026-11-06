import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native'
import SwipeBackModal from '../common/SwipeBackModal'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { SPACING } from '../../constants/spacing'
import { FONTS } from '../../constants/typography'
import type { AppNotice, NoticeComparison } from '../../constants/appNotices'
import ModalHeader, { ModalPanel } from './ModalHeader'
import ContentColumn from '../common/ContentColumn'

interface NoticeDetailModalProps {
  visible: boolean
  notice: AppNotice | null
  onClose: () => void
}

export default function NoticeDetailModal({ visible, notice, onClose }: NoticeDetailModalProps) {
  return (
    <SwipeBackModal visible={visible} onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
        <ContentColumn>
        <ModalHeader title="공지사항" onClose={onClose} />
        {notice && <NoticeDetailContent notice={notice} />}
        </ContentColumn>
      </SafeAreaView>
      </SafeAreaProvider>
    </SwipeBackModal>
  )
}

/**
 * 공지 본문(날짜·제목·글·비교). 설정의 공지 목록 창은 창을 새로 띄우지 않고 이 본문으로 바꿔 보여 준다 —
 * iOS 에서 목록 창을 닫으며 본문 창을 띄우면 본문이 안 뜨고 화면이 멈췄다(11-06, 지연을 줘도 됐다 안 됐다).
 */
export function NoticeDetailContent({ notice }: { notice: AppNotice }) {
  return (
    <ModalPanel>
      <ScrollView style={styles.body}>
        <Text style={styles.date}>{notice.date}</Text>
        <Text style={styles.title}>{notice.title}</Text>
        <Text style={styles.text}>{notice.body}</Text>
        {notice.comparison && <Comparison comparison={notice.comparison} />}
      </ScrollView>
    </ModalPanel>
  )
}

/** "이전 → 이후" 비교. 이후 문장의 {{ }} 부분(바뀐 곳)만 메인 컬러로 강조한다. */
function Comparison({ comparison }: { comparison: NoticeComparison }) {
  return (
    <View style={styles.compare}>
      <Text style={styles.compareTitle}>{comparison.title}</Text>
      {comparison.rows.map((row) => (
        <View key={row.label} style={styles.compareRow}>
          <Text style={styles.compareLabel}>{row.label}</Text>
          <View style={styles.beforeBox}>
            <Text style={styles.boxTag}>이전</Text>
            <Text style={styles.beforeText}>{row.before}</Text>
          </View>
          <View style={styles.afterBox}>
            <Text style={[styles.boxTag, styles.afterTag]}>이후</Text>
            <Text style={styles.afterText}>
              {row.after.split(/\{\{|\}\}/).map((part, i) =>
                i % 2 === 1 ? (
                  <Text key={i} style={styles.changed}>
                    {part}
                  </Text>
                ) : (
                  part
                ),
              )}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  // 회색 바탕 위에 머리 카드와 둥근 흰 본문 판이 뜬다(10-07 설정 탭과 같은 모양).
  container: { flex: 1, backgroundColor: COLORS.background },
  // 글자 왼쪽 끝을 아래 카드들과 같은 28(판 바깥 12 + 안쪽 16)에 맞춘다(10-08).
  body: { flex: 1, paddingHorizontal: SPACING.lg, paddingVertical: 20 },
  date: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginBottom: 8 },
  title: { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 16 },
  text: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, lineHeight: 22 },
  compare: { marginTop: 24, paddingBottom: 32, gap: 16 },
  compareTitle: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  compareRow: { gap: 6 },
  compareLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  beforeBox: { borderRadius: 10, padding: 12, backgroundColor: COLORS.background, gap: 4 },
  afterBox: { borderRadius: 10, padding: 12, backgroundColor: COLORS.primarySoft, gap: 4 },
  boxTag: { fontFamily: FONTS.semibold, fontSize: 11, color: COLORS.textTertiary },
  afterTag: { color: COLORS.primary },
  beforeText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary, lineHeight: 21 },
  afterText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, lineHeight: 21 },
  changed: { fontFamily: FONTS.semibold, color: COLORS.primary },
})
