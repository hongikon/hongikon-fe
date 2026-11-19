import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { REPORT_STATUS_LABEL, formatDateTime, formatMemberRef, formatRelative } from '../../format'
import { useCommentModeration } from '../../hooks/useCommentModeration'
import type { AdminComment, AdminFlaggedComment } from '../../types'
import { Badge, Button, Card, ConfirmBar, InlineError, useAdminHost, type Tone } from '../../ui'
import {
  COMMENT_ACTION_META,
  commentActionLabel,
  commentActionsFor,
  commentStatusLabel,
  flagCountLabel,
  flagReasonsText,
  type CommentAction,
} from '../../utils/commentModeration'
import { CommentReasonFields } from './CommentReasonFields'

interface Props {
  item: AdminFlaggedComment
  /** 이번에 이 화면에서 한 처리. 있으면 흐리게 '방금 …'으로 남긴다. */
  handled: CommentAction | null
  /** 관리자 알림으로 연 댓글이면 테두리로 강조한다. */
  highlighted: boolean
  onDone: (updated: AdminComment, action: CommentAction) => void
}

/** 신고 댓글 카드 한 장: 상태·신고 배지, 제보·본문, 사유·작성자·시각, 처리 버튼(숨김·삭제는 사유 입력). */
export function FlaggedCommentCard({ item, handled, highlighted, onDone }: Props) {
  const app = useAdminHost() === 'app'
  const { pending, busy, error, confirming, setConfirming, reason, setReason, run, onPress } = useCommentModeration(item, app, onDone)

  const reasons = flagReasonsText(item.flagReasons)
  // 표시 이름 + 회원 번호만. authorNickname(예전 서버는 로그인 닉네임 원문)은 쓰지 않는다(개인정보 최소 처리).
  const author = formatMemberRef(item.authorDisplayName, item.authorMemberCode, item.authorId)
  const statusLabel = commentStatusLabel(item.status, !!handled)
  const statusTone: Tone = item.status === 'VISIBLE' ? 'success' : item.status === 'HIDDEN' ? 'warning' : 'neutral'
  const actions = commentActionsFor(item)

  return (
    <Card style={[styles.card, highlighted && styles.cardHighlighted, handled && styles.cardHandled]}>
      <View style={styles.top}>
        <View style={styles.badges}>
          <Badge label={statusLabel} tone={statusTone} />
          {/* 처리한 뒤에는 서버가 그 전 신고를 더 세지 않는다 — "검토 대기"로 남겨 두지 않는다. */}
          <Badge label={flagCountLabel(item, !!handled)} tone={handled ? 'neutral' : 'danger'} />
          {item.parentId ? <Badge label={`#${item.parentId}의 답글`} tone="info" /> : null}
          {handled ? <Badge label={`방금 ${COMMENT_ACTION_META[handled].done}`} tone="info" /> : null}
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
          confirmLabel={COMMENT_ACTION_META[confirming].label}
          danger
          busy={pending === confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run(confirming, reason)}
        >
          <CommentReasonFields reason={reason} onChangeReason={setReason} busy={busy} app={app} />
        </ConfirmBar>
      ) : actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Button
              key={action}
              label={commentActionLabel(item, action)}
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
})
