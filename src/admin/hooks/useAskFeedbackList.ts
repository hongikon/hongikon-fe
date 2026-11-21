import { useMemo, useState } from 'react'
import { getErrorMessage } from '../../apis/client'
import { fetchAskFeedback, reviewAskFeedback } from '../api'
import type { AdminAskFeedbackItem, AskFeedbackFilter } from '../types'
import { applyReviewed, filterByReason, type AskDays, type ReasonFilter } from '../utils/askFeedback'
import { useAdminLoad } from './useAdminLoad'

/**
 * 물어보기 피드백 목록: 확인 상태·기간으로 서버에서 받고, 이유 칩은 받은 목록을 화면에서 거른다.
 * 상태·기간을 바꾸면 이전 목록을 비운다.
 */
export function useAskFeedbackList() {
  const [filter, setFilter] = useState<AskFeedbackFilter>('OPEN')
  const [days, setDays] = useState<AskDays>('30')
  const [reason, setReason] = useState<ReasonFilter>('ALL')
  const { data, setData, loading, error, reload } = useAdminLoad(
    (signal) => fetchAskFeedback(filter, Number(days), signal),
    (err) => getErrorMessage(err, '물어보기 피드백을 불러오지 못했습니다.'),
    [filter, days],
  )

  const items = useMemo(() => filterByReason(data?.items ?? [], reason), [data, reason])

  const changeFilter = (next: AskFeedbackFilter) => {
    if (next === filter) return
    setData(null)
    setFilter(next)
  }

  const changeDays = (next: AskDays) => {
    if (next === days) return
    setData(null)
    setDays(next)
  }

  const markReviewed = (item: AdminAskFeedbackItem, reviewed: boolean) =>
    reviewAskFeedback(item.source, item.id, reviewed).then(() =>
      setData((prev) => applyReviewed(prev, item, reviewed, new Date().toISOString())),
    )

  return { filter, days, reason, setReason, data, loading, error, reload, items, changeFilter, changeDays, markReviewed }
}
