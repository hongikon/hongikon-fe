import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../../constants/colors'
import { FONTS } from '../../../../constants/typography'
import { isNetworkError } from '../../../../apis/client'
import { formatCommentTime } from '../../../../utils/map/report/comments'
import RetryableError from '../../../common/RetryableError'
import CommentAvatar from './CommentAvatar'
import type { ReportListItem } from '../../../../types'
import { RADIUS } from '../../../../constants/spacing'
import { useReportCommentsSection } from '../../../../hooks/map/report/comments/useReportCommentsSection'

export interface ReportCommentsSectionProps {
  report: ReportListItem
  /** 제보 본문 창(본문 + 댓글 전체)을 연다. "댓글 달기"면 입력칸에 바로 초점을 준다. */
  onOpen: (focusInput: boolean) => void
  /** 바뀌면 미리보기를 다시 받는다(본문 창에서 쓰거나 지운 것을 반영). */
  refreshKey?: number
}

/**
 * 제보 시트의 댓글 미리보기: "댓글 N", 최근 댓글 2개(한 줄 요약), "댓글 N개 모두 보기", 아래 "댓글 달기" 줄.
 * 쓰기·답글·신고는 제보 본문 창에서 한다(시트는 지도를 가리지 않게 짧게 둔다). 서버에 댓글 API 가 없으면 아무것도 그리지 않는다.
 */
export default function ReportCommentsSection({ report, onOpen, refreshKey = 0 }: ReportCommentsSectionProps) {
  const { accessToken, state, count, setReloadKey, preview, openWrite } = useReportCommentsSection({ report, onOpen, refreshKey })

  if (state.kind === 'unavailable') return null

  const total = count ?? 0

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.header}
        onPress={() => onOpen(false)}
        disabled={state.kind !== 'ready'}
        accessibilityRole="button"
        accessibilityLabel={total > 0 ? `댓글 ${total}개 모두 보기` : '댓글 보기'}
        hitSlop={6}
      >
        <Text style={styles.headerText}>
          댓글 <Text style={styles.headerCount}>{count === null ? '' : total}</Text>
        </Text>
        <View style={styles.spacer} />
        {state.kind === 'ready' && total > 0 ? (
          <>
            <Text style={styles.more}>댓글 {total}개 모두 보기</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} />
          </>
        ) : null}
      </Pressable>

      {/* 목록에서 이미 댓글이 0개로 왔으면 불러오는 중 줄을 그리지 않는다 — 그렸다가 지우면 시트가 한 번 튀었다. */}
      {state.kind === 'loading' && count === 0 ? null : state.kind === 'loading' ? (
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonDot} />
          <View style={styles.skeletonLine} />
        </View>
      ) : state.kind === 'error' ? (
        <RetryableError
          variant="chip"
          message={state.message}
          isNetworkError={state.network}
          onRetry={() => setReloadKey((key) => key + 1)}
          style={styles.error}
        />
      ) : preview.length > 0 ? (
        <Pressable onPress={() => onOpen(false)} accessibilityRole="button" accessibilityLabel="댓글 모두 보기">
          {preview.map((comment) => (
            <View key={comment.id} style={styles.item}>
              <CommentAvatar name={comment.authorDisplayName} seed={comment.authorKey} size={24} />
              <View style={styles.itemMain}>
                <Text style={styles.itemHead} numberOfLines={1}>
                  <Text style={styles.itemName}>{comment.authorDisplayName}</Text>
                  {'  '}
                  <Text style={styles.itemTime}>{formatCommentTime(comment.createdAt)}</Text>
                  {(comment.likeCount ?? 0) > 0 ? <Text style={styles.itemTime}>{` · 좋아요 ${comment.likeCount}`}</Text> : null}
                </Text>
                <Text style={styles.itemBody} numberOfLines={2}>
                  {comment.content}
                </Text>
              </View>
            </View>
          ))}
        </Pressable>
      ) : null}

      {state.kind !== 'error' ? (
        <Pressable
          style={({ pressed }) => [styles.write, pressed && styles.pressed]}
          onPress={openWrite}
          accessibilityRole="button"
          accessibilityLabel={accessToken ? '댓글 달기' : '로그인하고 댓글 달기'}
        >
          <Text style={styles.writeText}>
            {accessToken ? (total > 0 ? '댓글 달기…' : '첫 댓글을 남겨 보세요') : '로그인하고 댓글 달기'}
          </Text>
          <Ionicons name="create-outline" size={16} color={COLORS.textTertiary} />
        </Pressable>
      ) : null}

    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 28 },
  headerText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  headerCount: { color: COLORS.primary },
  spacer: { flex: 1 },
  more: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  item: { flexDirection: 'row', gap: 8, paddingVertical: 5 },
  itemMain: { flex: 1, minWidth: 0 },
  itemHead: { fontSize: 12 },
  itemName: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.textPrimary },
  itemTime: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textTertiary },
  itemBody: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: COLORS.textPrimary, marginTop: 1 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  skeletonDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.fill },
  skeletonLine: { flex: 1, height: 12, borderRadius: 6, backgroundColor: COLORS.fill },
  error: { marginTop: 6 },
  write: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.fill,
  },
  pressed: { opacity: 0.7 },
  writeText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
})
