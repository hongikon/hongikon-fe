import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { reportCategoryMeta } from '../../constants/reportCategories'
import { formatFreshness, reportImageUrls } from '../../utils/reports'
import { openExternalUrl } from '../../utils/openExternalUrl'
import OfficialBadge from '../common/OfficialBadge'
import ReportActionRow, { type ReportCommunityPatch } from './ReportActionRow'
import { reportAuthorName } from '../../utils/nickname'
import type { ReportListItem } from '../../types'

/**
 * 제보 본문(게시글) — 종류 배지, 제목, 시각·장소, 본문 전체, 사진, 작성자, 공감·관심·공유.
 * 제보 본문 창(ReportCommentsModal) 맨 위에 놓이고, 아래로 댓글이 이어진다(10-09 — 본문과 댓글을 한 게시글 화면으로).
 * 본문은 길게 눌러 복사할 수 있다.
 */
export default function ReportPostBody({
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
    <View style={styles.body}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  body: { paddingTop: 20, paddingBottom: 4 },
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
