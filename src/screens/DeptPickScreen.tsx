import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../constants/colors'
import { useSettings } from '../contexts/SettingsContext'
import { completeDeptPick } from '../lib/onboarding'
import ContentColumn from '../components/common/ContentColumn'
import DeptPickStep from '../components/onboarding/DeptPickStep'
import AppLoadingScreen from './AppLoadingScreen'

/**
 * 첫 실행의 "내 학과 고르기"(어떤 소식을 받아볼까요?). 웰컴에서 로그인하거나 둘러보기를 누른 뒤, 메인 대신 한 번 뜬다
 * (`RootNavigator`, 남았는지는 `src/lib/onboarding.ts` 의 `useDeptPickPending`).
 *
 * - 고르는 즉시 설정(SettingsContext)의 구독 목록에 들어간다(`DeptPickStep`). 로그인 상태면 그 길로 바로 계정(서버)에
 *   저장되고, 게스트면 기기에만 두었다가 나중에 로그인할 때 서버 구독과 합쳐 올라간다.
 * - 이미 구독이 있으면(다른 기기에서 구독해 둔 계정으로 로그인, 이전 버전 온보딩에서 골라 둠 등) 묻지 않고 건너뛴다.
 *   로그인 상태면 서버 구독과 한 번 합쳐 볼 때까지(`boardSubscriptionsReady`) 로딩 화면으로 기다렸다가 판단한다 —
 *   그러지 않으면 빈 목록으로 학과 고르기가 떴다가 서버 구독이 도착하며 사라진다.
 *   판단은 화면이 뜰 때 한 번만 한다. 고르기 시작한 뒤에 구독이 생겼다고 화면을 닫으면 안 된다.
 * - 로그인 뒤라 되돌아갈 이전 단계(소개·웰컴)가 없다. 뒤로 버튼은 두지 않고, "나중에 할게요"로 건너뛸 수 있다.
 */
export default function DeptPickScreen() {
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

  if (decision !== 'show') return <AppLoadingScreen />

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 폴드를 펼친 화면·넓은 웹 창에서도 목록·버튼이 가운데 한 폭에 모이게 한다(온보딩 화면과 같게). */}
      <ContentColumn>
        {/* 온보딩의 뒤로 버튼 줄과 같은 높이를 비워 두어 제목 위치가 온보딩 단계들과 같게 보이게 한다. */}
        <View style={styles.header} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <DeptPickStep onNext={finish} />
        </KeyboardAvoidingView>
      </ContentColumn>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  header: { height: 52 },
})
