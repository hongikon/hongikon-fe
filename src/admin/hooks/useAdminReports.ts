import { useCallback, useState } from 'react'
import { getErrorMessage } from '../../apis/client'
import { fetchReports } from '../api'
import type { AdminReport, ReportStatusFilter } from '../types'
import { useAdminLoad } from './useAdminLoad'
import {
  applyReportUpdate,
  belongsTo,
  inRange,
  kstDate,
  periodRange,
  shiftDay,
  splitsActive,
  type Period,
  type ScreenFilter,
} from '../utils/reportReview'

/**
 * 제보 검토 목록: 상태 탭·등록일 기간·날짜 지정과, 그 조건으로 서버 목록을 받아 화면에서 한 번 더 거르는 일.
 * 조건을 바꾸면 이전 목록을 비워 다른 탭의 제보가 잠깐 보이지 않게 한다.
 */
export function useAdminReports(initialFilter: ReportStatusFilter | undefined, onChanged: () => void) {
  const [filter, setFilter] = useState<ScreenFilter>(initialFilter ?? 'PENDING')
  const [period, setPeriod] = useState<Period>('all')
  const [day, setDay] = useState(() => kstDate(Date.now()))
  const {
    data: reports,
    setData: setReports,
    loading,
    error,
    reload,
  } = useAdminLoad(
    (signal) => {
      // '노출 중'·'예정'·'종료'는 모두 서버의 ACTIVE 목록을 받아 시작·종료 시각으로 나눈다.
      const range = periodRange(period, day)
      const split = splitsActive(filter)
      return fetchReports(splitsActive(filter) ? 'ACTIVE' : filter, signal, range).then((list) =>
        list.filter((item) => inRange(item, range) && (split ? belongsTo(item, filter) : true)),
      )
    },
    (err) => getErrorMessage(err, '제보 목록을 불러오지 못했습니다.'),
    [filter, period, day],
  )

  const changeFilter = (next: ScreenFilter) => {
    if (next === filter) return
    setReports(null)
    setFilter(next)
  }

  const changePeriod = (next: Period) => {
    setReports(null)
    setPeriod(next)
  }

  /** 오늘(한국 날짜) 이후로는 못 넘긴다. */
  const isLatestDay = day >= kstDate(Date.now())

  const prevDay = () => {
    setReports(null)
    setDay((d) => shiftDay(d, -1))
  }

  const nextDay = () => {
    if (day >= kstDate(Date.now())) return
    setReports(null)
    setDay((d) => shiftDay(d, 1))
  }

  const handleUpdated = useCallback(
    (updated: AdminReport) => {
      setReports((prev) => applyReportUpdate(prev, updated))
      onChanged()
    },
    [onChanged],
  )

  return { filter, period, day, reports, loading, error, changeFilter, changePeriod, isLatestDay, prevDay, nextDay, reload, handleUpdated }
}
