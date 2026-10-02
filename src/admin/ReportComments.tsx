import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getErrorMessage } from '../apis/client'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { confirmAction } from '../utils/dialog'
import { fetchReportComments, isAdminCommentsMissing, updateCommentStatus } from './api'
import { FLAG_REASON_LABEL, formatDateTime, formatRelative } from './format'
import type { AdminComment, AdminCommentStatus, FlagReason } from './types'
import { Badge, Button, InlineError, useAdminHost, type Tone } from './ui'

const STATUS_META: Record<AdminCommentStatus, { label: string; tone: Tone }> = {
  VISIBLE: { label: '공개', tone: 'success' },
  HIDDEN: { label: '숨김', tone: 'neutral' },
  DELETED: { label: '삭제됨', tone: 'neutral' },
}

type CommentAction = 'hide' | 'delete' | 'restore'

const ACTION_META: Record<CommentAction, { label: string; target: AdminCommentStatus; confirm: string; destructive?: boolean }> = {
  hide: { label: '숨김', target: 'HIDDEN', confirm: '이 댓글을 숨길까요? 앱에서 바로 내려가고, 나중에 다시 공개할 수 있습니다.', destructive: true },
  delete: { label: '삭제', target: 'DELETED', confirm: '이 댓글을 삭제할까요? 앱에서 내려가며 기록은 제보와 함께 지워질 때까지 남습니다.', destructive: true },
  restore: { label: '다시 공개', target: 'VISIBLE', confirm: '이 댓글을 다시 공개할까요? 이후 새 신고가 3건 쌓이면 다시 자동으로 숨겨집니다.' },
}

/**
 * 작성자가 스스로 지운 댓글(관리자 검토 기록 없음)은 되살리지 않는다 — 작성자의 삭제 의사를 따른다.
 * 관리자가 숨기거나 지운 댓글만 다시 공개할 수 있다.
 */
function actionsFor(comment: AdminComment): CommentAction[] {
  switch (comment.status) {
    case 'VISIBLE':
      return ['hide', 'delete']
    case 'HIDDEN':
      return ['restore', 'delete']
    case 'DELETED':
      return comment.reviewedAt ? ['restore'] : []
  }
}

/** 서버는 id 순으로 준다 — 답글을 그 최상위 댓글 바로 아래로 모아 대화 순서로 보여 준다. */
function byThread(comments: AdminComment[]): AdminComment[] {
  const replies = new Map<number, AdminComment[]>()
  for (const c of comments) {
    if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c])
  }
  const roots = comments.filter((c) => !c.parentId)
  const rootIds = new Set(roots.map((c) => c.id))
  const orphans = comments.filter((c) => c.parentId && !rootIds.has(c.parentId))
  return [...roots.flatMap((root) => [root, ...(replies.get(root.id) ?? [])]), ...orphans]
}

/** 서버에 댓글 관리 API 가 없으면(배포 전) 한 번 확인한 뒤로는 토글 자체를 감춘다. */
let commentsApiMissing = false

/**
 * 제보 카드 안의 댓글 검토. 접어 두었다가 펼칠 때 `GET /admin/reports/{id}/comments` 를 부른다(카드마다 미리 부르지 않음).
 * 웹 콘솔과 앱 관리 탭이 함께 쓴다 — 앱에서는 처리 전에 확인 창으로 한 번 묻는다.
 */
export function ReportCommentsPanel({ reportId }: { reportId: number }) {
  const app = useAdminHost() === 'app'
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<AdminComment[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(commentsApiMissing)
  const [pending, setPending] = useState<{ id: number; action: CommentAction } | null>(null)
  const [actionError, setActionError] = useState<{ id: number; message: string } | null>(null)

  if (missing && !open) return null

  const load = () => {
    setLoading(true)
    setError(null)
    fetchReportComments(reportId)
      .then(setComments)
      .catch((err: unknown) => {
        if (isAdminCommentsMissing(err)) {
          commentsApiMissing = true
          setMissing(true)
          return
        }
        setError(getErrorMessage(err, '댓글을 불러오지 못했습니다.'))
      })
      .finally(() => setLoading(false))
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !comments && !loading) load()
  }

  const run = (comment: AdminComment, action: CommentAction) => {
    setPending({ id: comment.id, action })
    setActionError(null)
    updateCommentStatus(comment.id, ACTION_META[action].target)
      .then((updated) => setComments((prev) => prev?.map((item) => (item.id === updated.id ? updated : item)) ?? prev))
      .catch((err: unknown) => setActionError({ id: comment.id, message: getErrorMessage(err, '처리하지 못했습니다. 다시 시도해주세요.') }))
      .finally(() => setPending(null))
  }

  const onAction = (comment: AdminComment, action: CommentAction) => {
    if (!app) {
      run(comment, action)
      return
    }
    confirmAction({
      title: `댓글 ${ACTION_META[action].label}`,
      message: `${ACTION_META[action].confirm}\n\n"${comment.content.slice(0, 60)}"`,
      confirmLabel: ACTION_META[action].label,
      destructive: ACTION_META[action].destructive,
      onConfirm: () => run(comment, action),
    })
  }

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
            const author = comment.authorNickname ?? `사용자 #${comment.authorId}`
            const shown = comment.authorDisplayName && comment.authorDisplayName !== comment.authorNickname
              ? ` (앱 표시: ${comment.authorDisplayName})`
              : ''
            return (
              <View
                key={comment.id}
                style={[styles.item, comment.parentId ? styles.itemReply : null, comment.status !== 'VISIBLE' && styles.itemMuted]}
              >
                <View style={styles.itemTop}>
                  {comment.parentId ? <Badge label={`↳ #${comment.parentId}의 답글`} tone="info" /> : null}
                  <Badge label={comment.status === 'DELETED' && !comment.reviewedAt ? '작성자가 지움' : status.label} tone={status.tone} />
                  {comment.flagCount > 0 ? <Badge label={`신고 ${comment.flagCount}${reasons ? ` · ${reasons}` : ''}`} tone="danger" /> : null}
                  <Text style={styles.meta}>#{comment.id}</Text>
                </View>
                <Text style={styles.content}>{comment.content}</Text>
                <Text style={styles.meta}>
                  {author}
                  {shown} · 회원 #{comment.authorId} · {formatDateTime(comment.createdAt)} ({formatRelative(comment.createdAt, now)})
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
    borderRadius: 10,
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
