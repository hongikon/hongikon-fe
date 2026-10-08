import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { reportCategoryMeta } from '../../constants/reportCategories'
import { formatFreshness, reportImageUrls } from '../../utils/reports'
import { openExternalUrl } from '../../utils/openExternalUrl'
import ModalHeader, { ModalPanel } from '../settings/ModalHeader'
import ContentColumn from '../common/ContentColumn'
import OfficialBadge from '../common/OfficialBadge'
import ReportActionRow, { type ReportCommunityPatch } from './ReportActionRow'
import ReportCommentsSection from './comments/ReportCommentsSection'
import { reportAuthorName } from '../../utils/nickname'
import type { ReportListItem } from '../../types'

interface ReportContentModalProps {
  report: ReportListItem | null
  /** 장소 문구(시트와 같은 값 — 작성자가 고친 장소 설명, 없으면 가까운 건물). */
  placeText: string
  /** 공감·관심·조회 수 변화를 지도 시트 사본에도 반영한다(시트와 같은 applyPatch). */
  onPatch: (patch: ReportCommunityPatch) => void
  onClose: () => void
}

/**
 * 제보 본문 전체 보기. 지도 시트에는 본문을 두 줄만 보여 주고, '본문 보기'를 누르면 이 창이
 * 화면 전체(아래 탭 막대까지 덮음)로 올라와 학생회 공지처럼 긴 안내도 편하게 읽게 한다. 본문은 길게 눌러 복사할 수 있다.
 * 게시글처럼 본문 아래에 공감·관심·공유, 작성자, 댓글(미리보기 → 전체 댓글 창)을 시트와 똑같이 붙인다.
 */
export default function ReportContentModal({ report, placeText, onPatch, onClose }: ReportContentModalProps) {
  const visible = report !== null
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ContentColumn style={styles.column}>
            <ModalHeader title="제보 본문" onClose={onClose} />
            <ModalPanel>{report && <Body report={report} placeText={placeText} onPatch={onPatch} />}</ModalPanel>
          </ContentColumn>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

function Body({
  report,
  placeText,
  onPatch,
}: {
  report: ReportListItem
  placeText: string
  onPatch: (patch: ReportCommunityPatch) => void
}) {
  const meta = reportCategoryMeta(report.category)
  const photos = reportImageUrls(report)
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.badge}>
        <Ionicons name={meta.icon} size={12} color={COLORS.white} />
        <Text style={styles.badgeText}>{report.customCategoryLabel || meta.label}</Text>
      </View>
      <Text style={styles.title} selectable>
        {report.title}
      </Text>
      <Text style={styles.meta}>{formatFreshness(report)}</Text>
      <View style={styles.placeRow}>
        <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
        <Text style={styles.placeText}>{placeText}</Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.content} selectable>
        {report.content?.trim()}
      </Text>

      {photos.length > 0 && (
        <View style={styles.photos}>
          {photos.map((url, index) => (
            <Pressable
              key={url}
              onPress={() => openExternalUrl(url)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`제보 첨부 사진 ${index + 1}/${photos.length}, 원본 보기`}
            >
              <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.authorRow}>
        <Text style={styles.author} numberOfLines={1}>
          {reportAuthorName(report)}
        </Text>
        {report.authorOfficial ? <OfficialBadge /> : null}
      </View>

      <ReportActionRow report={report} onPatch={onPatch} />

      <ReportCommentsSection key={report.id} report={report} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  column: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  badgeText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.white },
  title: { fontFamily: FONTS.bold, fontSize: 19, lineHeight: 26, color: COLORS.textPrimary, marginTop: 10 },
  meta: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4 },
  placeText: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: COLORS.textSecondary },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  content: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 24, color: COLORS.textPrimary },
  photos: { gap: 10, marginTop: 20 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 20 },
  author: { flexShrink: 1, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: COLORS.fill },
})
