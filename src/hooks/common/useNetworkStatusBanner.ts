import { useEffect, useRef, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConnectivity } from '../../lib/connectivity'
import { RECOVERED_NOTICE_MS } from '../../utils/common/networkStatusBanner'

/** NetworkStatusBanner 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNetworkStatusBanner() {
  const { status, checking } = useConnectivity()
  const insets = useSafeAreaInsets()
  const [dismissed, setDismissed] = useState(false)
  const [showRecovered, setShowRecovered] = useState(false)
  const prevStatusRef = useRef(status)

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (status !== 'online') {
      // 복구 안내가 떠 있는 2초 안에 다시 끊기면 위 타이머는 정리돼 안내가 내려가지 않았다(showRecovered 가 true 로 남음).
      // 그러면 아래 숨김 조건이 늘 거짓이라 닫기(X)를 눌러도 배너가 사라지지 않았다.
      setShowRecovered(false)
      return
    }

    setDismissed(false)
    // 배너를 보고 있던 사용자에게만 복구를 알린다.
    if (prev === 'online') return
    setShowRecovered(true)
    const timer = setTimeout(() => setShowRecovered(false), RECOVERED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [status])

  const disconnected = status !== 'online'
  return { status, checking, insets, dismissed, setDismissed, showRecovered, disconnected }
}
