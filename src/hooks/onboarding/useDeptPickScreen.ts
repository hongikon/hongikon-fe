import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '../../contexts/SettingsContext'
import { completeDeptPick } from '../../lib/onboarding'

/** DeptPickScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDeptPickScreen() {
  const { settings, boardSubscriptionsReady } = useSettings()
  const hasSubscriptions = settings.subscribedDepts.length > 0
  // null: 아직 판단 전(서버 구독을 기다리는 중), 'skip': 이미 구독이 있어 넘김, 'show': 고르게 함.
  const [decision, setDecision] = useState<'skip' | 'show' | null>(null)
  const decidedRef = useRef(false)

  useEffect(() => {
    if (decidedRef.current || !boardSubscriptionsReady) return
    decidedRef.current = true
    if (hasSubscriptions) {
      setDecision('skip')
      void completeDeptPick()
    } else {
      setDecision('show')
    }
  }, [boardSubscriptionsReady, hasSubscriptions])

  const finish = useCallback(() => {
    void completeDeptPick()
  }, [])
  return { decision, finish }
}
