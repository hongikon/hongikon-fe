import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage, isCancelledError } from '../../../apis/client'
import { fetchFeedback } from '../../api'
import type { AdminFeedback, AdminOverview, FeedbackStatusFilter } from '../../types'

/** FeedbackScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useFeedbackScreen({ onChanged, overview }: Pick<{
  onChanged: () => void
  overview: AdminOverview | null
  /** 관리자 알림으로 연 문의. 목록에 있으면 맨 위로 올려 강조한다. */
  focusFeedbackId?: number | null
}, 'onChanged' | 'overview'>) {
  const [filter, setFilter] = useState<FeedbackStatusFilter>('OPEN')
  const [items, setItems] = useState<AdminFeedback[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchFeedback(filter, controller.signal)
      .then(setItems)
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(getErrorMessage(err, '문의 목록을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [filter, reloadKey])

  const changeFilter = (next: FeedbackStatusFilter) => {
    if (next === filter) return
    setItems(null)
    setFilter(next)
  }

  const handleUpdated = useCallback(
    (updated: AdminFeedback) => {
      setItems((prev) => prev?.map((item) => (item.id === updated.id ? updated : item)) ?? prev)
      onChanged()
    },
    [onChanged],
  )

  const tabs = [
    { value: 'OPEN' as const, label: '미처리', count: overview?.feedback.open },
    { value: 'RESOLVED' as const, label: '처리 완료' },
    { value: 'ALL' as const, label: '전체' },
  ]
  return { filter, items, loading, error, setReloadKey, changeFilter, handleUpdated, tabs }
}
