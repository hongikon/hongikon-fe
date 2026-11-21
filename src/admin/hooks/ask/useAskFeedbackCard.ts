import { useState } from 'react'
import { getErrorMessage } from '../../../apis/client'
import type { AdminAskFeedbackItem } from '../../types'

/** AskFeedbackCard 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useAskFeedbackCard({ item, onReview }: Pick<{
  item: AdminAskFeedbackItem
  onReview: (item: AdminAskFeedbackItem, reviewed: boolean) => Promise<void>
}, 'item' | 'onReview'>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [writing, setWriting] = useState(false)
  const [noted, setNoted] = useState(false)
  const reviewed = item.reviewedAt !== null

  const toggle = () => {
    setPending(true)
    setError(null)
    onReview(item, !reviewed)
      .catch((err: unknown) => setError(getErrorMessage(err, '상태를 바꾸지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setPending(false))
  }
  return { pending, error, open, setOpen, writing, setWriting, noted, setNoted, reviewed, toggle }
}
