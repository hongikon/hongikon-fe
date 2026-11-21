import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage, isCancelledError } from '../../../apis/client'
import { fetchOverview } from '../../api'
import type { AdminOverview, OverviewState } from '../../types'

/**
 * 웹 콘솔의 대시보드 수치 + 메뉴 배지. `enabled`(로그인 완료)가 되면 받고, 처리 작업 뒤 각 화면이 refresh 를 부른다.
 * 새로 부르면 이전 요청은 끊는다. 앱 관리 탭은 AdminAccess 의 useAdminOverview 를 쓴다.
 */
export function useConsoleOverview(enabled: boolean) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [overviewUpdatedAt, setOverviewUpdatedAt] = useState<number | null>(null)
  const overviewAbort = useRef<AbortController | null>(null)

  const refreshOverview = useCallback(() => {
    overviewAbort.current?.abort()
    const controller = new AbortController()
    overviewAbort.current = controller
    setOverviewLoading(true)
    fetchOverview(controller.signal)
      .then((data) => {
        setOverview(data)
        setOverviewError(null)
        setOverviewUpdatedAt(Date.now())
      })
      .catch((error: unknown) => {
        if (isCancelledError(error)) return
        setOverviewError(getErrorMessage(error, '대시보드 정보를 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (overviewAbort.current === controller) setOverviewLoading(false)
      })
  }, [])

  useEffect(() => {
    if (enabled) refreshOverview()
    return () => overviewAbort.current?.abort()
  }, [enabled, refreshOverview])

  const overviewState: OverviewState = {
    data: overview,
    loading: overviewLoading,
    error: overviewError,
    updatedAt: overviewUpdatedAt,
    refresh: refreshOverview,
  }

  return { overview, setOverview, overviewState, refreshOverview }
}
