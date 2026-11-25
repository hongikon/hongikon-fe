import { useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { initOnboarding, useOnboardingDone } from '../../lib/onboarding'

/** OnboardingGate 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useOnboardingGate() {
  const { status } = useAuth()
  const done = useOnboardingDone()

  useEffect(() => {
    // 앱 실행 시점의 로그인 상태로 한 번만 판단한다(initOnboarding 이 두 번째 호출부터는 무시한다).
    void initOnboarding(status === 'guest' || status === 'authenticated')
  }, [])
  return { done }
}
