import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { getErrorMessage, isCancelledError } from '../../apis/client'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { confirmAction } from '../../utils/dialog'
import { fetchFlaggedComments, isAdminCommentsMissing, updateCommentStatus } from '../api'
import { FLAG_REASON_LABEL, REPORT_STATUS_LABEL, formatDateTime, formatMemberRef, formatRelative } from '../format'
import type { AdminComment, AdminCommentStatus, AdminFlaggedComment, AdminOverview, FlagReason } from '../types'
import { Badge, Button, Card, ConfirmBar, EmptyState, InlineError, Loading, ScreenHeader, useAdminHost, type Tone } from '../ui'

/**
 * 숨김·삭제 사유 버튼. 작성자 알림에 그대로 들어간다. 서버가 사유를 비웠을 때 쓰는 신고 사유 문구(ReportCommentService.FLAG_REASON_LABELS)와 같다.
 */
const MODERATION_REASONS = ['욕설·비하 등 부적절한 내용', '스팸·광고', '개인정보 노출', '허위 정보'] as const
const FLAG_TO_REASON: Record<string, (typeof MODERATION_REASONS)[number]> = {
  INAPPROPRIATE: '욕설·비하 등 부적절한 내용',
  SPAM: '스팸·광고',
  PRIVACY: '개인정보 노출',
  FALSE_INFO: '허위 정보',
}

/** 가장 많이 들어온 신고 사유의 문구(기타·없음이면 빈칸). */
function topReasonLabel(flagReasons: Record<string, number> | null | undefined): string {
  let best = ''
  let bestCount = 0
  for (const [code, count] of Object.entries(flagReasons ?? {})) {
    if (FLAG_TO_REASON[code] && count > bestCount) {
      best = FLAG_TO_REASON[code]
      bestCount = count
    }
  }
  return best
}

/** 숨김·삭제 사유 최대 길이(서버 제한과 같다). */
const REASON_MAX_LENGTH = 200

type Action = 'keep' | 'hide' | 'delete' | 'restore'

const ACTION_META: Record<Action, { label: string; target: AdminCommentStatus; done: string }> = {
  keep: { label: '검토 완료(유지)', target: 'VISIBLE', done: '검토 완료 · 유지' },
  hide: { label: '숨김', target: 'HIDDEN', done: '숨김 처리함' },
  delete: { label: '삭제', target: 'DELETED', done: '삭제함' },
  restore: { label: '다시 공개', target: 'VISIBLE', done: '다시 공개함' },
}

/**
 * 공개 중이면 유지·숨김·삭제, 신고 누적으로 자동 숨김됐으면 다시 공개·숨김 유지(사유와 함께 작성자에게 다시 알림)·삭제.
 * 어떤 처리든 서버가 검토 시각을 남겨 그 전 신고는 더 세지 않는다 — 그래서 처리한 댓글은 다음에 목록을 받을 때 빠진다.
 */
function actionsFor(comment: AdminComment): Action[] {
  if (comment.status === 'VISIBLE') return ['keep', 'hide', 'delete']
  if (comment.status === 'HIDDEN') return ['restore', 'hide', 'delete']
  return []
}

/**
 * 신고 댓글 — 마지막 검토 뒤 신고가 들어온 댓글을 최근 신고 순으로 모아 본다(`GET /admin/comments?filter=flagged`).
 * 제보 카드 안 댓글 패널(`ReportCommentsPanel`)은 제보마다 펼쳐야 해서, 여러 제보에 흩어진 신고를 놓치기 쉽다.
 * 숨김·삭제는 사유를 적을 수 있고, 서버가 그 사유와 14일 이의 제기 안내를 작성자에게 알린다(이용약관 제10조).
 * 처리한 카드는 "방금 처리함"으로 남겨 두어 실수했을 때 바로 되돌릴 수 있게 한다.
 */
export default function FlaggedCommentsScreen({
  onChanged,
  overview,
  focusCommentId = null,
}: {
  onChanged: () => void
  overview: AdminOverview | null
  /** 관리자 알림(ADMIN_COMMENT_FLAGGED)으로 연 댓글. 목록에 있으면 맨 위로 올려 강조한다. */
  focusCommentId?: number | null
}) {
  const [items, setItems] = useState<AdminFlaggedComment[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  /** 이번에 처리한 댓글 id → 처리 내용. 카드를 지우지 않고 흐리게 남긴다. */
  const [handled, setHandled] = useState<Record<number, Action>>({})
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchFlaggedComments(controller.signal)
      .then((result) => {
        setItems(result.comments)
        setTotal(result.total)
        setHandled({})
      })
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        if (isAdminCommentsMissing(err)) {
          setMissing(true)
          return
        }
        setError(getErrorMessage(err, '신고된 댓글을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey])

  const reload = () => setReloadKey((key) => key + 1)

  const handleDone = useCallback(
    (updated: AdminComment, action: Action) => {
      setItems((prev) => prev?.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)) ?? prev)
      setHandled((prev) => ({ ...prev, [updated.id]: action }))
      onChanged()
    },
    [onChanged],
  )

  const pendingCount = overview?.comments?.flaggedPending ?? total
  const header = (
    <ScreenHeader
      title="신고 댓글"
      subtitle={`마지막 검토 뒤 신고가 들어온 댓글을 최근 신고 순으로 보여 줍니다(최대 200건). 검토 대기 ${pendingCount}건.`}
      right={<Button label="새로고침" icon="refresh" onPress={reload} loading={loading && !!items} small />}
    />
  )

  if (missing) {
    return (
      <View>
        {header}
        <InlineError message="서버 업데이트가 필요합니다. 신고된 댓글 목록은 새 서버에서 볼 수 있어요. 지금은 제보 검토의 제보 카드 안 댓글에서 처리해 주세요." />
      </View>
    )
  }

  return (
    <View>
      {header}
      {error ? <InlineError message={error} onRetry={reload} style={styles.listError} /> : null}
      {!items ? (
        loading ? <Loading /> : null
      ) : items.length === 0 ? (
        <EmptyState message="검토할 신고 댓글이 없습니다." />
      ) : (
        <View style={styles.list}>
          {withFocusedFirst(items, focusCommentId).map((item) => (
            <FlaggedCommentCard
              key={item.id}
              item={item}
              handled={handled[item.id] ?? null}
              highlighted={item.id === focusCommentId}
              onDone={handleDone}
            />
          ))}
        </View>
      )}
    </View>
  )
}

/** 알림으로 연 항목을 맨 위로(나머지 순서는 그대로). */
function withFocusedFirst<T extends { id: number }>(items: T[], focusId: number | null): T[] {
  if (focusId === null) return items
  const focused = items.find((item) => item.id === focusId)
  return focused ? [focused, ...items.filter((item) => item !== focused)] : items
}

function FlaggedCommentCard({
  item,
  handled,
  highlighted,
  onDone,
}: {
  item: AdminFlaggedComment
  handled: Action | null
  highlighted: boolean
  onDone: (updated: AdminComment, action: Action) => void
}) {
  const app = useAdminHost() === 'app'
  const [pending, setPending] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 사유를 받는 확인 막대(숨김·삭제). */
  const [confirming, setConfirming] = useState<'hide' | 'delete' | null>(null)
  const [reason, setReason] = useState('')

  const run = (action: Action, withReason?: string) => {
    setPending(action)
    setError(null)
    updateCommentStatus(item.id, ACTION_META[action].target, withReason)
      .then((updated) => {
        setConfirming(null)
        setReason('')
        onDone(updated, action)
      })
      .catch((err: unknown) => setError(getErrorMessage(err, '처리하지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setPending(null))
  }

  const onPress = (action: Action) => {
    if (action === 'hide' || action === 'delete') {
      setError(null)
      // 사유를 한 번 눌러 고르게, 가장 많이 들어온 신고 사유를 미리 골라 둔다(관리자는 사유를 비워 두기 쉽다).
      setReason(topReasonLabel(item.flagReasons))
      setConfirming(action)
      return
    }
    if (action === 'restore' && app) {
      confirmAction({
        title: '댓글 다시 공개',
        message: `이 댓글을 다시 공개할까요? 이후 새 신고가 3건 쌓이면 다시 자동으로 숨겨집니다.\n\n"${(item.content ?? '').slice(0, 60)}"`,
        confirmLabel: '다시 공개',
        onConfirm: () => run('restore'),
      })
      return
    }
    run(action)
  }

  const reasons = Object.entries(item.flagReasons ?? {})
    .map(([key, count]) => `${FLAG_REASON_LABEL[key as FlagReason] ?? key} ${count}`)
    .join(', ')
  // 표시 이름 + 회원 번호만. authorNickname(예전 서버는 로그인 닉네임 원문)은 쓰지 않는다(개인정보 최소 처리).
  const author = formatMemberRef(item.authorDisplayName, item.authorMemberCode, item.authorId)
  // 검토 대기 중인 숨김은 늘 신고 누적 자동 숨김이다(관리자가 숨긴 댓글은 더 신고할 수 없다).
  const statusLabel = item.status === 'VISIBLE' ? '공개 중' : item.status === 'HIDDEN' ? (handled ? '숨김' : '자동 숨김') : '삭제됨'
  const statusTone: Tone = item.status === 'VISIBLE' ? 'success' : item.status === 'HIDDEN' ? 'warning' : 'neutral'
  const actions = actionsFor(item)
  const busy = pending !== null

  return (
    <Card style={[styles.card, highlighted && styles.cardHighlighted, handled && styles.cardHandled]}>
      <View style={styles.top}>
        <View style={styles.badges}>
          <Badge label={statusLabel} tone={statusTone} />
          {/* 처리한 뒤에는 서버가 그 전 신고를 더 세지 않는다 — "검토 대기"로 남겨 두지 않는다. */}
          {handled ? (
            <Badge label={`신고 ${item.flagCount}건`} tone="neutral" />
          ) : (
            <Badge
              label={`신고 ${item.pendingFlagCount}건 검토 대기${item.flagCount > item.pendingFlagCount ? ` · 전체 ${item.flagCount}` : ''}`}
              tone="danger"
            />
          )}
          {item.parentId ? <Badge label={`#${item.parentId}의 답글`} tone="info" /> : null}
          {handled ? <Badge label={`방금 ${ACTION_META[handled].done}`} tone="info" /> : null}
        </View>
        <Text style={styles.meta}>#{item.id}</Text>
      </View>

      <Text style={styles.reportLine} numberOfLines={1}>
        제보 <Text style={styles.reportTitle}>{item.reportTitle}</Text>
        {item.reportStatus !== 'ACTIVE' ? ` · ${REPORT_STATUS_LABEL[item.reportStatus] ?? item.reportStatus}` : ''}
        {` · #${item.reportId}`}
      </Text>
      <Text selectable style={styles.content}>
        {item.content}
      </Text>

      <View style={styles.facts}>
        {reasons ? <Text style={styles.fact}>사유 {reasons}</Text> : null}
        <Text style={styles.fact}>작성자 <Text style={styles.factStrong}>{author}</Text></Text>
        <Text style={styles.fact}>
          작성 {formatDateTime(item.createdAt)} ({formatRelative(item.createdAt)})
        </Text>
        {item.lastFlaggedAt ? <Text style={styles.fact}>마지막 신고 {formatRelative(item.lastFlaggedAt)}</Text> : null}
      </View>

      {confirming ? (
        <ConfirmBar
          message={
            confirming === 'hide'
              ? '이 댓글을 숨길까요? 앱에서 바로 내려가고, 나중에 다시 공개할 수 있습니다. 작성자에게 사유와 이의 제기 안내가 알림으로 갑니다.'
              : '이 댓글을 삭제할까요? 앱에서 내려가며 작성자에게 사유와 이의 제기 안내가 알림으로 갑니다.'
          }
          confirmLabel={ACTION_META[confirming].label}
          danger
          busy={pending === confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run(confirming, reason)}
        >
          <View style={styles.reasonChips} accessibilityRole="radiogroup" accessibilityLabel="사유 고르기">
            {MODERATION_REASONS.map((label) => {
              const selected = reason === label
              return (
                <Pressable
                  key={label}
                  onPress={() => setReason(selected ? '' : label)}
                  disabled={busy}
                  style={[styles.reasonChip, selected && styles.reasonChipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  hitSlop={4}
                >
                  <Text style={[styles.reasonChipText, selected && styles.reasonChipTextOn]}>{label}</Text>
                </Pressable>
              )
            })}
          </View>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="직접 적기(선택) · 비우면 가장 많은 신고 사유로 알려요"
            placeholderTextColor={COLORS.textPlaceholder}
            maxLength={REASON_MAX_LENGTH}
            style={[styles.reasonInput, app && styles.reasonInputApp]}
            editable={!busy}
            multiline={app}
            returnKeyType="done"
            submitBehavior={app ? 'blurAndSubmit' : undefined}
            accessibilityLabel="숨김·삭제 사유"
          />
          <Text style={styles.counter}>
            작성자에게 그대로 보입니다. 신고자나 개인정보는 적지 마세요. {reason.length}/{REASON_MAX_LENGTH}
          </Text>
        </ConfirmBar>
      ) : actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Button
              key={action}
              label={item.status === 'HIDDEN' && action === 'hide' ? '숨김 유지' : ACTION_META[action].label}
              onPress={() => onPress(action)}
              loading={pending === action}
              disabled={busy}
              variant={action === 'keep' || action === 'restore' ? 'primary' : action === 'delete' ? 'ghost' : 'secondary'}
              small
            />
          ))}
        </View>
      ) : null}
      {error ? <InlineError message={error} /> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  reasonChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  reasonChipText: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.textSecondary },
  reasonChipTextOn: { color: COLORS.white },
  listError: { marginBottom: 12 },
  list: { gap: 12 },
  card: { gap: 10 },
  cardHandled: { opacity: 0.7, borderStyle: 'dashed' },
  cardHighlighted: { borderColor: COLORS.primary, borderWidth: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flexShrink: 1 },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  reportLine: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  reportTitle: { fontFamily: FONTS.medium, color: COLORS.textPrimary },
  content: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: COLORS.textPrimary },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  fact: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  factStrong: { fontFamily: FONTS.medium, color: COLORS.textPrimary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 },
  reasonInput: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reasonInputApp: { minHeight: 72, fontSize: 15, textAlignVertical: 'top', paddingVertical: 10 },
  counter: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textSecondary },
})
