import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { initOnboarding, useOnboardingDone } from '../../lib/onboarding'
import AppLoadingScreen from '../../screens/AppLoadingScreen'

/**
 * 온보딩을 보여줄지 정할 때까지 아래(SettingsProvider·내비게이션)를 그리지 않는다.
 *
 * AuthProvider 안이어야 하고(로그인·게스트 여부로 예전 사용자를 가려낸다), SettingsProvider 보다 바깥이어야 한다 —
 * SettingsProvider 는 불러온 설정을 곧바로 다시 저장해서, 먼저 돌면 처음 켠 사용자도 "저장된 설정이 있는" 예전 사용자로 보인다.
 * 판단은 기기 저장소 읽기 한 번이라 순간적이고, 그동안은 AuthProvider 와 같은 로딩 화면을 이어서 보여준다.
 */
export default function OnboardingGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const done = useOnboardingDone()

  useEffect(() => {
    // 앱 실행 시점의 로그인 상태로 한 번만 판단한다(initOnboarding 이 두 번째 호출부터는 무시한다).
    void initOnboarding(status === 'guest' || status === 'authenticated')
  }, [])

  if (done === null) return <AppLoadingScreen />
  return <>{children}</>
}
