import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import FlameIcon from '../../common/FlameIcon'
import type { ReportListItem } from '../../../types'
import { useReportActionRow } from '../../../hooks/map/report/useReportActionRow'
import { formatCount } from '../../../utils/map/report/reportActionRow'

/** 시트가 들고 있는 제보 사본에 덮어쓸 값(🔥·관심·조회 수). */
export type ReportCommunityPatch = Partial<
  Pick<ReportListItem, 'fireCount' | 'recentFireCount' | 'hot' | 'firedByMe' | 'followedByMe' | 'viewCount'>
>

export interface ReportActionRowProps {
  report: ReportListItem
  onPatch: (patch: ReportCommunityPatch) => void
}

/**
 * 제보 시트의 반응 줄: 🔥 공감 · 관심 · 공유 · 👀 조회 수.
 * 서버가 해당 필드를 주지 않으면(커뮤니티 기능 배포 전) 그 버튼은 그리지 않는다. 공유는 서버와 상관없이 늘 된다.
 * 내 제보는 🔥 수만 보이고(누를 수 없음) 관심 버튼이 없다.
 */
export default function ReportActionRow({ report, onPatch }: ReportActionRowProps) {
  const { busy, hasFire, hasFollow, hasViews, fired, followed, handleFire, handleFollow, handleShare, fireCount } = useReportActionRow({ report, onPatch })

  return (
    <View style={styles.row}>
      {hasFire ? (
        <Pressable
          onPress={() => void handleFire()}
          disabled={busy === 'follow'}
          style={({ pressed }) => [
            styles.chip,
            fired && styles.chipOn,
            report.isMine && styles.chipReadOnly,
            pressed && !report.isMine && styles.chipPressed,
          ]}
          accessibilityRole={report.isMine ? 'text' : 'button'}
          accessibilityState={{ selected: fired }}
          accessibilityLabel={
            report.isMine
              ? `내 제보, 공감 ${fireCount}개`
              : `공감 ${fireCount}개, ${fired ? '내가 공감했어요. 누르면 취소해요' : '눌러서 공감하기'}`
          }
          hitSlop={4}
        >
          <FlameIcon variant={fired ? 'full' : 'outline'} size={18} />
          <Text style={[styles.count, fired && styles.countOn]}>{formatCount(fireCount)}</Text>
        </Pressable>
      ) : null}

      {hasFollow ? (
        <Pressable
          onPress={() => void handleFollow()}
          disabled={busy === 'follow'}
          style={({ pressed }) => [styles.chip, followed && styles.chipOn, pressed && styles.chipPressed]}
          accessibilityRole="switch"
          accessibilityState={{ checked: followed }}
          accessibilityLabel={followed ? '관심 제보, 켜짐. 누르면 알림을 그만 받아요' : '관심 제보로 등록하고 알림 받기'}
          hitSlop={4}
        >
          <Ionicons name={followed ? 'star' : 'star-outline'} size={16} color={followed ? COLORS.fire : COLORS.primary} />
          <Text style={[styles.label, followed && styles.countOn]}>관심</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => void handleShare()}
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        accessibilityRole="button"
        accessibilityLabel="제보 공유하기"
        hitSlop={4}
      >
        <Ionicons name="share-outline" size={16} color={COLORS.primary} />
        <Text style={styles.label}>공유</Text>
      </Pressable>

      <View style={styles.spacer} />

      {hasViews ? (
        <View style={styles.viewsRow} accessibilityLabel={`조회 ${report.viewCount}회`}>
          <Ionicons name="eye-outline" size={14} color={COLORS.textTertiary} />
          <Text style={styles.views}>{formatCount(report.viewCount ?? 0)}</Text>
        </View>
      ) : null}
    </View>
  )
}

// FINAL.md: 안 누름 — 흰 바탕, #DFE2EC 1.5px, 글자 #05014A 600. 누름 — 흰 바탕, #0B1A8C 2px, 글자 #0B1A8C 800.
// 높이는 같게(테두리가 두꺼워져도 height 고정), 바깥 빛·그림자 없음. 테두리 차이만큼 좌우 여백을 줄여 폭도 흔들리지 않게 한다.
const CHIP_HEIGHT = 36
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: CHIP_HEIGHT,
    paddingHorizontal: 12,
    borderRadius: CHIP_HEIGHT / 2,
    borderWidth: 1.5,
    borderColor: COLORS.fireChipBorder,
    backgroundColor: COLORS.white,
  },
  chipOn: { borderWidth: 2, borderColor: COLORS.fire, paddingHorizontal: 11.5 },
  chipReadOnly: { opacity: 0.85 },
  chipPressed: { backgroundColor: COLORS.primarySoft },
  count: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.primary, fontVariant: ['tabular-nums'] },
  countOn: { fontFamily: FONTS.bold, color: COLORS.fire },
  label: { fontFamily: FONTS.semibold, fontSize: 13.5, color: COLORS.primary },
  spacer: { flex: 1 },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  views: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textTertiary, fontVariant: ['tabular-nums'] },
})
