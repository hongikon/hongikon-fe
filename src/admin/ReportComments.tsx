import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { FLAG_REASON_LABEL, formatDateTime, formatMemberRef, formatRelative } from './format'
import type { AdminCommentStatus, FlagReason } from './types'
import { Badge, Button, InlineError, type Tone } from './ui'
import { RADIUS } from '../constants/spacing'
import { useReportCommentsPanel } from './hooks/comments/useReportCommentsPanel'
import { actionsFor, byThread } from './utils/comments/reportComments'
import { ACTION_META } from './utils/comments/reportComments'

const STATUS_META: Record<AdminCommentStatus, { label: string; tone: Tone }> = {
  VISIBLE: { label: '공개', tone: 'success' },
  HIDDEN: { label: '숨김', tone: 'neutral' },
  DELETED: { label: '삭제됨', tone: 'neutral' },
}

/**
 * 제보 카드 안의 댓글 검토. 접어 두었다가 펼칠 때 `GET /admin/reports/{id}/comments` 를 부른다(카드마다 미리 부르지 않음).
 * 웹 콘솔과 앱 관리 탭이 함께 쓴다 — 앱에서는 처리 전에 확인 창으로 한 번 묻는다.
 */
export function ReportCommentsPanel({ reportId }: { reportId: number }) {
  const { app, open, setOpen, comments, setComments, loading, setLoading, error, setError, missing, setMissing, pending, setPending, actionError, setActionError, load, toggle, onAction } = useReportCommentsPanel({ reportId })

  if (missing && !open) return null

  const visibleCount = comments?.filter((c) => c.status === 'VISIBLE').length ?? 0
  const hiddenCount = comments?.filter((c) => c.status === 'HIDDEN').length ?? 0
  const summary = comments
    ? `댓글 ${comments.length}건${hiddenCount ? ` · 숨김 ${hiddenCount}` : ''}${comments.length - visibleCount - hiddenCount ? ` · 삭제 ${comments.length - visibleCount - hiddenCount}` : ''}`
    : '댓글'
  const now = Date.now()

  return (
    <View>
      <Pressable onPress={toggle} accessibilityRole="button" hitSlop={12} style={styles.toggle} accessibilityState={{ expanded: open }}>
        <Ionicons name="chatbubbles-outline" size={16} color={COLORS.textSecondary} />
        <Text style={styles.toggleText}>{summary}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textSecondary} />
      </Pressable>
      {open ? (
        <View style={styles.list}>
          {loading ? <Text style={styles.meta}>불러오는 중…</Text> : null}
          {missing ? <Text style={styles.meta}>서버에 댓글 기능이 아직 배포되지 않았습니다.</Text> : null}
          {error ? <InlineError message={error} onRetry={load} /> : null}
          {comments && comments.length === 0 ? <Text style={styles.meta}>댓글이 없습니다.</Text> : null}
          {comments && byThread(comments).map((comment) => {
            const status = STATUS_META[comment.status]
            const reasons = Object.entries(comment.flagReasons ?? {})
              .map(([reason, count]) => `${FLAG_REASON_LABEL[reason as FlagReason] ?? reason} ${count}`)
              .join(', ')
            // 표시 이름 + 회원 번호만. authorNickname(예전 서버는 로그인 닉네임 원문)은 쓰지 않는다(개인정보 최소 처리).
            const author = formatMemberRef(comment.authorDisplayName, comment.authorMemberCode, comment.authorId)
            return (
              <View
                key={comment.id}
                style={[styles.item, comment.parentId ? styles.itemReply : null, comment.status !== 'VISIBLE' && styles.itemMuted]}
              >
                <View style={styles.itemTop}>
                  {comment.parentId ? <Badge label={`#${comment.parentId}의 답글`} tone="info" /> : null}
                  <Badge label={comment.status === 'DELETED' && !comment.reviewedAt ? '작성자가 지움' : status.label} tone={status.tone} />
                  {comment.flagCount > 0 ? <Badge label={`신고 ${comment.flagCount}${reasons ? ` · ${reasons}` : ''}`} tone="danger" /> : null}
                  <Text style={styles.meta}>#{comment.id}</Text>
                </View>
                <Text style={styles.content}>{comment.content}</Text>
                <Text style={styles.meta}>
                  {author} · {formatDateTime(comment.createdAt)} ({formatRelative(comment.createdAt, now)})
                </Text>
                {comment.reviewedAt ? <Text style={styles.meta}>관리자 처리: {formatDateTime(comment.reviewedAt)}</Text> : null}
                {actionsFor(comment).length > 0 ? (
                  <View style={styles.actions}>
                    {actionsFor(comment).map((action) => (
                      <Button
                        key={action}
                        label={ACTION_META[action].label}
                        onPress={() => onAction(comment, action)}
                        loading={pending?.id === comment.id && pending.action === action}
                        disabled={pending !== null}
                        variant={action === 'restore' ? 'primary' : action === 'delete' ? 'ghost' : 'secondary'}
                        small
                      />
                    ))}
                  </View>
                ) : null}
                {actionError?.id === comment.id ? <InlineError message={actionError.message} /> : null}
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  toggleText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textSecondary },
  list: { gap: 8, marginTop: 4 },
  item: {
    padding: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    gap: 4,
  },
  itemReply: { marginLeft: 16, borderLeftWidth: 2, borderLeftColor: COLORS.border },
  itemMuted: { opacity: 0.75 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  content: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: COLORS.textPrimary },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  actions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
})
