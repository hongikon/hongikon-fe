import { useEffect, useState } from 'react'
import { getErrorMessage, isCancelledError } from '../../../apis/client'
import { fetchAskReport } from '../../api'
import type { AdminAskReport } from '../../types'

/** AskReportView 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useAskReportView() {
  const [days, setDays] = useState<'7' | '30'>('7')
  const [report, setReport] = useState<AdminAskReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetchAskReport(Number(days), controller.signal)
      .then(setReport)
      .catch((err: unknown) => {
        if (!isCancelledError(err)) setError(getErrorMessage(err, '요약을 불러오지 못했습니다.'))
      })
    return () => controller.abort()
  }, [days, reloadKey])

  const answered = report ? report.resolvedYes + report.resolvedNo : 0
  return { days, setDays, report, setReport, error, setReloadKey, answered }
}
