import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../common/Toast'
import FlameIcon from '../common/FlameIcon'
import * as haptics from '../../lib/haptics'
import { communityErrorMessage, isCommunityApiMissing, setReportFire, setReportFollow } from '../../apis/community'
import { promptLogin } from '../../utils/reports'
import { shareReport } from '../../utils/shareReport'
import type { ReportListItem } from '../../types'
import { useMapData } from '../../lib/mapData'

/** 시트가 들고 있는 제보 사본에 덮어쓸 값(🔥·관심·조회 수). */
export type ReportCommunityPatch = Partial<
  Pick<ReportListItem, 'fireCount' | 'recentFireCount' | 'hot' | 'firedByMe' | 'followedByMe' | 'viewCount'>
>

interface ReportActionRowProps {
  report: ReportListItem
  onPatch: (patch: ReportCommunityPatch) => void
}

/** 1,234 → '1,234', 12,300 → '1.2만'. */
export function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}만`
  return n.toLocaleString('ko-KR')
}

/**
 * 제보 시트의 반응 줄: 🔥 공감 · 관심 · 공유 · 👀 조회 수.
 * 서버가 해당 필드를 주지 않으면(커뮤니티 기능 배포 전) 그 버튼은 그리지 않는다. 공유는 서버와 상관없이 늘 된다.
 * 내 제보는 🔥 수만 보이고(누를 수 없음) 관심 버튼이 없다.
 */
export default function ReportActionRow({ report, onPatch }: ReportActionRowProps) {
  // 장소 문구(가까운 건물)는 지도 데이터의 건물로 찾는다. 아직 없으면 좌표 대신 학교 이름이 나온다.
  const { buildings } = useMapData()
  const { accessToken, logout } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState<'fire' | 'follow' | null>(null)
  const [missing, setMissing] = useState(false)
  // 연타 중 늦게 온 응답이 최신 상태를 덮지 않게 요청 순번을 둔다.
  const fireSeq = useRef(0)

  const hasFire = typeof report.fireCount === 'number' && !missing
  const hasFollow = typeof report.followedByMe === 'boolean' && !report.isMine && !missing
  const hasViews = typeof report.viewCount === 'number'
  const fired = !!report.firedByMe
  const followed = !!report.followedByMe

  const handleFire = async () => {
    if (report.isMine) {
      toast.show({ message: '내 제보에는 공감할 수 없어요', tone: 'info' })
      return
    }
    if (!accessToken) {
      promptLogin('공감하려면 로그인해 주세요.', logout)
      return
    }
    const next = !fired
    const before = { firedByMe: fired, fireCount: report.fireCount ?? 0 }
    if (next) haptics.switchOn()
    else haptics.tapLight()
    // 낙관적 반영 — 실패하면 되돌린다.
    onPatch({ firedByMe: next, fireCount: Math.max(0, before.fireCount + (next ? 1 : -1)) })
    const seq = ++fireSeq.current
    setBusy('fire')
    try {
      const result = await setReportFire(report.id, next, accessToken)
      if (seq !== fireSeq.current) return
      onPatch({
        firedByMe: result.fired,
        fireCount: result.fireCount,
        ...(typeof result.recentFireCount === 'number' ? { recentFireCount: result.recentFireCount } : {}),
        ...(typeof result.hot === 'boolean' ? { hot: result.hot } : {}),
      })
    } catch (error) {
      if (seq !== fireSeq.current) return
      onPatch(before)
      if (isCommunityApiMissing(error, true)) {
        setMissing(true)
        return
      }
      toast.show({ message: communityErrorMessage(error, '공감하지 못했어요. 잠시 뒤 다시 해 주세요.'), tone: 'warning' })
    } finally {
      if (seq === fireSeq.current) setBusy(null)
    }
  }

  const handleFollow = async () => {
    if (!accessToken) {
      promptLogin('관심 제보로 등록하려면 로그인해 주세요.', logout)
      return
    }
    const next = !followed
    if (next) haptics.switchOn()
    else haptics.tapLight()
    onPatch({ followedByMe: next })
    setBusy('follow')
    try {
      const result = await setReportFollow(report.id, next, accessToken)
      onPatch({ followedByMe: result.followed })
      toast.show({
        message: result.followed
          ? '관심 제보로 등록했어요. 시작할 때, 끝나기 30분 전, 새 댓글이 달리면 알려 드려요'
          : '관심 제보에서 뺐어요',
      })
    } catch (error) {
      onPatch({ followedByMe: !next })
      if (isCommunityApiMissing(error, true)) {
        setMissing(true)
        return
      }
      toast.show({ message: communityErrorMessage(error, '관심 제보를 바꾸지 못했어요.'), tone: 'warning' })
    } finally {
      setBusy(null)
    }
  }

  const handleShare = async () => {
    haptics.tapLight()
    const result = await shareReport(report, buildings)
    if (result === 'copied') toast.show({ message: '링크를 복사했어요' })
    else if (result === 'failed') toast.show({ message: '공유하지 못했어요', tone: 'warning' })
  }

  const fireCount = report.fireCount ?? 0

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
