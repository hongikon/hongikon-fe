import { useEffect, useRef, useState } from 'react'
import { Keyboard, TextInput } from 'react-native'
import { useAuth } from '../../../../contexts/AuthContext'
import * as haptics from '../../../../lib/haptics'
import { getErrorMessage } from '../../../../apis/client'
import { commentWriteErrorMessage, createReportComment } from '../../../../apis/comments'
import { useMutation } from '../../../query/useMutation'
import type { CommentComposerProps } from '../../../../components/map/report/comments/CommentComposer'

/** CommentComposer 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useCommentComposer({ reportId, onPosted, focusKey = 0 }: Pick<CommentComposerProps, 'reportId' | 'onPosted' | 'focusKey'>) {
  const { accessToken, logout } = useAuth()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (focusKey > 0) inputRef.current?.focus()
  }, [focusKey])

  /** 댓글 쓰기는 서버가 만든 댓글(id·작성자 이름)을 받아 목록에 넣는다(낙관적 반영 없음). */
  const postMutation = useMutation(
    ({ body, token, parentId }: { body: string; token: string; parentId?: number }) =>
      createReportComment(reportId, body, token, parentId),
    {
      onMutate: () => setError(null),
      onSuccess: (created) => {
        haptics.success()
        setText('')
        Keyboard.dismiss()
        onPosted(created)
      },
      onError: (caught) => {
        setError(commentWriteErrorMessage(caught) ?? getErrorMessage(caught, '댓글을 남기지 못했어요. 잠시 뒤 다시 시도해 주세요.'))
      },
    },
  )

  const sending = postMutation.pending
  return { accessToken, logout, text, setText, error, setError, inputRef, postMutation, sending }
}
