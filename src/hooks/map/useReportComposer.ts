import { useCallback, useRef, useState } from 'react'
import type { ReportTarget } from '../../components/map/report/ReportComposerModal'
import { promptLogin } from '../../utils/map/report/reports'

interface Options {
  accessToken: string | null
  logout: () => void
  /** 제보 레이어가 켜져 있는지. 켜져 있으면 등록 뒤 목록을 새로 받는다. */
  reportsOn: boolean
  retryReports: () => void
  /** 지도 가운데 핀으로 제보 위치를 고르기 시작한다. */
  startPicker: () => void
}

/**
 * 제보 작성창: 지도를 길게 눌러 잡은 위치(또는 핀으로 고른 위치)로 연다. 제보는 로그인이 필요해서
 * 위치를 고르고 작성창을 다 채운 뒤가 아니라 시작할 때 묻는다.
 */
export function useReportComposer(options: Options) {
  const optionsRef = useRef(options)
  optionsRef.current = options
  // 지도를 길게 눌러 잡은 제보 위치. null 이면 작성창이 닫혀 있다.
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)

  /** 제보는 로그인이 필요하다. 게스트면 로그인을 묻고 false. */
  const requireLogin = useCallback((): boolean => {
    const { accessToken, logout } = optionsRef.current
    if (!accessToken) {
      promptLogin('제보를 남기려면 로그인해 주세요.', logout)
      return false
    }
    return true
  }, [])

  /** 게스트는 위치를 고르고 작성창을 다 채운 뒤가 아니라 시작할 때 묻는다. */
  const handleStartPicker = useCallback(() => {
    if (!requireLogin()) return
    optionsRef.current.startPicker()
  }, [requireLogin])

  /**
   * 제보 등록 성공. 작성창은 닫지 않는다 — 새 제보는 `PENDING`(운영진 검토 대기)이라 지도에는 승인 후에
   * 뜨므로, 작성창이 그 안내를 보여 주고 사용자가 '확인'을 눌러 닫는다(onClose).
   * 레이어가 켜져 있으면 목록은 새로 받아 둔다(그 사이 승인된 다른 제보 반영).
   */
  const handleCreated = useCallback(() => {
    const { reportsOn, retryReports } = optionsRef.current
    if (reportsOn) retryReports()
  }, [])

  const close = useCallback(() => setReportTarget(null), [])

  return { reportTarget, open: setReportTarget, close, requireLogin, handleStartPicker, handleCreated }
}
