import { useCallback, useState } from 'react'

/**
 * 지도 위 안내 줄 상태: 네이버 지도 인증 실패 여부와, 사용자가 닫은 안내 줄 기록.
 */
export function useMapNotices() {
  // 네이버 지도 인증 실패. 실패해도 지도는 빈 화면으로만 남아, 알리지 않으면
  // 사용자가 앱이 멈춘 것으로 오해한다.
  const [mapAuthFailed, setMapAuthFailed] = useState(false)
  const reportMapAuthFailure = useCallback(() => setMapAuthFailed(true), [])
  const dismissMapAuthError = useCallback(() => setMapAuthFailed(false), [])

  /**
   * 지도 위 안내 줄(캠퍼스 밖 N곳 등)을 탭하거나 X 로 닫은 기록. 문구 단위로 기억해, 숫자가 바뀌는 등
   * 내용이 달라지면 다시 보여 준다. 앱을 다시 켜면 초기화된다.
   */
  const [dismissedNotices, setDismissedNotices] = useState<ReadonlySet<string>>(() => new Set())
  const dismissNotice = useCallback((message: string) => {
    setDismissedNotices((prev) => new Set(prev).add(message))
  }, [])

  return { mapAuthFailed, reportMapAuthFailure, dismissMapAuthError, dismissedNotices, dismissNotice }
}
