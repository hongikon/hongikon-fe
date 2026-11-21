import { memo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { TYPE } from '../../../constants/typography'
import { RADIUS, SPACING } from '../../../constants/spacing'
import type { MyReport } from '../../../apis/myReports'
import { formatDateTime } from '../../../admin/format'
import { formatReportSchedule, isUpcomingReport } from '../../../utils/reportSchedule'
import { reportImageUrls } from '../../../utils/reports'
import { resolveDisplayStatus, STATUS_META } from '../../../utils/settings/myReportStatus'
import { CATEGORY_BY_KEY, categoryLabel, placeLabel } from '../../../utils/settings/myReports'
import { BODY_14, myReportsStyles as shared } from './styles'

interface MyReportCardProps {
  report: MyReport
  highlighted: boolean
  deleting: boolean
  onShowOnMap: (reportId: number) => void
  onDelete: (report: MyReport) => void
}

/** 내 제보 카드 한 장: 상태·등록일·제목·분류·장소·일정·사진·반려/숨김 사유·지도에서 보기·삭제. */
const MyReportCard = memo(function MyReportCard({ report, highlighted, deleting, onShowOnMap, onDelete }: MyReportCardProps) {
  const status = resolveDisplayStatus(report)
  // 승인 대기·승인된 제보 중 아직 시작 전인 것(끝난·반려된 제보엔 붙이지 않는다).
  const upcoming = (status === 'PENDING' || status === 'SCHEDULED') && isUpcomingReport(report)
  const meta = STATUS_META[status]
  const category = CATEGORY_BY_KEY.get(report.category)
  const place = placeLabel(report)
  const photos = reportImageUrls(report)
  const [failedPhotos, setFailedPhotos] = useState<ReadonlySet<string>>(new Set())
  const visiblePhotos = photos.filter((url) => !failedPhotos.has(url))
  const onMap = status === 'ACTIVE'
  const note = report.moderationNote?.trim()
  const showNote = !!note && (status === 'REJECTED' || status === 'HIDDEN')

  const content = (
    <>
      <View style={styles.cardTop}>
        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={13} color={meta.fg} />
          <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
        </View>
        <Text style={styles.createdAt}>{formatDateTime(report.createdAt).slice(0, 10)} 등록</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {report.title}
      </Text>

      <View style={styles.metaRow}>
        <View style={[styles.categoryChip, { borderColor: category?.color ?? COLORS.chipBorder }]}>
          <Ionicons name={category?.icon ?? 'ellipsis-horizontal'} size={12} color={category?.color ?? COLORS.chipText} />
          <Text style={[styles.categoryText, { color: category?.color ?? COLORS.chipText }]} numberOfLines={1}>
            {categoryLabel(report)}
          </Text>
        </View>
        {place && (
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={13} color={COLORS.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {place}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.metaItem}>
        <Ionicons name={upcoming ? 'calendar-outline' : 'time-outline'} size={13} color={COLORS.textTertiary} />
        {/* 지도·시트와 같은 형식(여러 날이면 끝 날짜도). 시작 전이면 '예정'을 붙인다. */}
        <Text style={styles.metaText}>
          {upcoming ? '예정 · ' : ''}
          {formatReportSchedule(report)}
        </Text>
      </View>

      {visiblePhotos.length > 0 && (
        <View style={styles.photoRow}>
          {visiblePhotos.map((url, index) => (
            <Image
              key={url}
              source={{ uri: url }}
              style={styles.photo}
              resizeMode="cover"
              accessibilityLabel={`첨부 사진 ${index + 1}`}
              onError={() => setFailedPhotos((prev) => new Set(prev).add(url))}
            />
          ))}
        </View>
      )}

      {showNote ? (
        <View style={[styles.noteBox, status === 'REJECTED' ? styles.noteRejected : styles.noteHidden]}>
          <Text style={[styles.noteTitle, status === 'REJECTED' && styles.noteTitleRejected]}>
            {status === 'REJECTED' ? '반려 사유' : '숨김 사유'}
          </Text>
          <Text style={styles.noteBody}>{note}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>{meta.hint}</Text>
      )}

      <View style={styles.cardFooter}>
        {onMap ? (
          <View style={styles.mapLink}>
            <Text style={styles.mapLinkText}>지도에서 보기</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </View>
        ) : (
          <View />
        )}
          <Pressable
            onPress={() => onDelete(report)}
            disabled={deleting}
            hitSlop={8}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${report.title} 제보 삭제`}
            accessibilityState={{ disabled: deleting, busy: deleting }}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={COLORS.textTertiary} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={14} color={COLORS.textTertiary} />
                <Text style={styles.deleteText}>삭제</Text>
              </>
            )}
          </Pressable>
      </View>
    </>
  )

  const cardStyle = [shared.card, highlighted && styles.cardHighlighted]
  if (!onMap) {
    return (
      <View style={cardStyle} accessibilityLabel={`${report.title}, ${meta.label}${showNote ? `, 사유 ${note}` : ''}`}>
        {content}
      </View>
    )
  }
  return (
    <Pressable
      onPress={() => onShowOnMap(report.id)}
      style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${report.title}, ${meta.label}`}
      accessibilityHint="지도에서 이 제보를 보여 줘요"
    >
      {content}
    </Pressable>
  )
})

export default MyReportCard

const styles = StyleSheet.create({
  cardHighlighted: { borderColor: COLORS.primary, borderWidth: 1.5 },
  pressed: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs + 1,
    borderRadius: RADIUS.pill,
  },
  statusText: { ...TYPE.label },
  createdAt: { ...TYPE.caption, ...BODY_14, color: COLORS.textTertiary },
  title: { ...TYPE.subhead, color: COLORS.textPrimary, marginTop: SPACING.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    maxWidth: 160,
  },
  categoryText: { ...TYPE.label },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs, flexShrink: 1 },
  metaText: { ...TYPE.caption, ...BODY_14, color: COLORS.textSecondary, flexShrink: 1 },
  photoRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  photo: { width: 64, height: 64, borderRadius: RADIUS.sm, backgroundColor: COLORS.fill },
  noteBox: { marginTop: SPACING.md, borderRadius: RADIUS.md, padding: SPACING.md },
  noteRejected: { backgroundColor: COLORS.dangerSoft },
  noteHidden: { backgroundColor: COLORS.fill },
  noteTitle: { ...TYPE.label, ...BODY_14, color: COLORS.textSecondary },
  noteTitleRejected: { color: COLORS.danger },
  noteBody: { ...TYPE.callout, ...BODY_14, color: COLORS.textPrimary, marginTop: SPACING.xs },
  hint: { ...TYPE.caption, ...BODY_14, color: COLORS.textTertiary, marginTop: SPACING.md },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xxs },
  mapLinkText: { ...TYPE.label, ...BODY_14, color: COLORS.primary },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, minHeight: 24, minWidth: 44, justifyContent: 'flex-end' },
  deleteText: { ...TYPE.caption, ...BODY_14, color: COLORS.textTertiary },
})
