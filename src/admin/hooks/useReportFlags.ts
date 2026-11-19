import { useState } from 'react'
import { getErrorMessage } from '../../apis/client'
import { fetchReportFlags } from '../api'
import type { AdminReportFlag } from '../types'

/** 제보 카드의 신고 내역 접기·펼치기. 처음 펼칠 때 한 번만 불러온다. */
export function useReportFlags(reportId: number) {
  const [flagsOpen, setFlagsOpen] = useState(false)
  const [flags, setFlags] = useState<AdminReportFlag[] | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [flagsError, setFlagsError] = useState<string | null>(null)

  const loadFlags = () => {
    setFlagsLoading(true)
    setFlagsError(null)
    fetchReportFlags(reportId)
      .then(setFlags)
      .catch((err: unknown) => setFlagsError(getErrorMessage(err, '신고 내역을 불러오지 못했습니다.')))
      .finally(() => setFlagsLoading(false))
  }

  const toggleFlags = () => {
    const next = !flagsOpen
    setFlagsOpen(next)
    if (next && !flags && !flagsLoading) loadFlags()
  }

  return { flagsOpen, flags, flagsLoading, flagsError, loadFlags, toggleFlags }
}
