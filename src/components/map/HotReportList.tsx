import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import FlameIcon from '../common/FlameIcon'
import HotBadge from '../common/HotBadge'
import { sortHot } from '../../apis/community'
import { formatCount } from './ReportActionRow'
import { reportPlaceText } from '../../utils/shareReport'
import type { ReportListItem } from '../../types'

interface HotReportListProps {
  reports: readonly ReportListItem[]
  selectedId: number | null
  onSelect: (report: ReportListItem) => void
}

/** 처음에 보여 줄 줄 수. 지도를 가리지 않게 짧게, "더 보기"로 최대 10줄까지. */
const COLLAPSED = 3
const EXPANDED = 10

/**
 * '🔥 HOT' 칩을 켰을 때 지도 위에 뜨는 짧은 목록. 최근 60분 🔥 순(같으면 전체 🔥 순). 누르면 그 제보 시트를 열고 가운데로 옮긴다.
 */
export default function HotReportList({ reports, selectedId, onSelect }: HotReportListProps) {
  const [expanded, setExpanded] = useState(false)
  // 목록이 지도를 가린다는 의견(10-06) — 머리줄의 접기로 작은 'HOT 목록' 단추만 남기고, 누르면 다시 편다.
  const [folded, setFolded] = useState(false)
  const sorted = sortHot(reports)
  const shown = sorted.slice(0, expanded ? EXPANDED : COLLAPSED)
  const more = Math.min(sorted.length, EXPANDED) - shown.length

  if (folded) {
    return (
      <Pressable
        onPress={() => setFolded(false)}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        accessibilityRole="button"
        accessibilityLabel={`HOT 제보 목록 펼치기, ${sorted.length}개`}
        hitSlop={6}
      >
        <FlameIcon variant="full" size={14} />
        <Text style={styles.pillText}>HOT 목록 {sorted.length}</Text>
        <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
      </Pressable>
    )
  }

  return (
    <View style={styles.card} accessibilityRole="list" accessibilityLabel="HOT 제보 목록">
      <View style={styles.header}>
        <Text style={styles.headerText}>지금 공감이 모이는 제보</Text>
        <Pressable
          onPress={() => setFolded(true)}
          hitSlop={10}
          style={styles.fold}
          accessibilityRole="button"
          accessibilityLabel="HOT 제보 목록 접기"
        >
          <Text style={styles.foldText}>접기</Text>
          <Ionicons name="chevron-up" size={13} color={COLORS.textSecondary} />
        </Pressable>
      </View>
      {shown.map((report, index) => {
        const recent = report.recentFireCount ?? 0
        return (
          <Pressable
            key={report.id}
            onPress={() => onSelect(report)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.rowDivider,
              (pressed || selectedId === report.id) && styles.rowActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}위 ${report.title}, 공감 ${report.fireCount ?? 0}개${recent > 0 ? `, 최근 한 시간 ${recent}개` : ''}`}
          >
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.main}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {report.title}
                </Text>
                {report.hot ? <HotBadge size="sm" /> : null}
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {reportPlaceText(report)}
                {recent > 0 ? ` · 최근 1시간 +${recent}` : ''}
              </Text>
            </View>
            <View style={styles.count}>
              <FlameIcon variant="full" size={15} />
              <Text style={styles.countText}>{formatCount(report.fireCount ?? 0)}</Text>
            </View>
          </Pressable>
        )
      })}
      {more > 0 || expanded ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={styles.toggle}
          accessibilityRole="button"
          hitSlop={4}
        >
          <Text style={styles.toggleText}>{expanded ? '접기' : `${more}개 더 보기`}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 2 },
  headerText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.textSecondary },
  fold: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 28 },
  foldText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.textSecondary },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.97)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  pillPressed: { opacity: 0.7 },
  pillText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 8, borderRadius: 10 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.divider },
  rowActive: { backgroundColor: COLORS.primarySoft },
  rank: { width: 16, textAlign: 'center', fontFamily: FONTS.bold, fontSize: 14, color: COLORS.fire },
  main: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  meta: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textTertiary, marginTop: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  countText: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.fire, fontVariant: ['tabular-nums'] },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 32 },
  toggleText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.textSecondary },
})
