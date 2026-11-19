import { useState } from 'react'
import { getErrorMessage } from '../../apis/client'
import { confirmAction } from '../../utils/dialog'
import { updateCommentStatus } from '../api'
import type { AdminComment, AdminFlaggedComment } from '../types'
import { COMMENT_ACTION_META, topReasonLabel, type CommentAction } from '../utils/commentModeration'

/**
 * 신고 댓글 카드의 처리 상태. 숨김·삭제는 사유를 받는 확인 막대를 펼치고(가장 많이 들어온 신고 사유를 미리 골라 둔다),
 * 앱에서 다시 공개는 확인 창으로 한 번 더 묻는다.
 */
export function useCommentModeration(
  item: AdminFlaggedComment,
  app: boolean,
  onDone: (updated: AdminComment, action: CommentAction) => void,
) {
  const [pending, setPending] = useState<CommentAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 사유를 받는 확인 막대(숨김·삭제). */
  const [confirming, setConfirming] = useState<'hide' | 'delete' | null>(null)
  const [reason, setReason] = useState('')

  const run = (action: CommentAction, withReason?: string) => {
    setPending(action)
    setError(null)
    updateCommentStatus(item.id, COMMENT_ACTION_META[action].target, withReason)
      .then((updated) => {
        setConfirming(null)
        setReason('')
        onDone(updated, action)
      })
      .catch((err: unknown) => setError(getErrorMessage(err, '처리하지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setPending(null))
  }

  const onPress = (action: CommentAction) => {
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

  return { pending, busy: pending !== null, error, confirming, setConfirming, reason, setReason, run, onPress }
}
