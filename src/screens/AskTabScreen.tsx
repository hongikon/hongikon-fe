import { useEffect } from 'react'
import { View } from 'react-native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AskChat from '../components/ask/AskChat'
import AskConsent from '../components/ask/tab/AskConsent'
import AskNotice from '../components/ask/tab/AskNotice'
import { tabStyles } from '../components/ask/tab/tabStyles'
import { useAuth } from '../contexts/AuthContext'
import { useAskTabNavigation } from '../hooks/ask/useAskTabNavigation'
import { useAskConsent, useAskStatus } from '../hooks/ask/useAskTabStatus'
import { useKeyboardOpen } from '../hooks/ask/useKeyboardOpen'
import { ROUTE_FINDING_ENABLED } from '../constants/route'
import { TAB_BAR_BASE_STYLE } from '../navigation/tabBarStyles'

/**
 * 하단 '물어보기' 탭(BETA, 11-01 — docs/ask-tab-plan.md). 탭은 모두에게 보이고, 질문은 로그인한 사용자만.
 * 처음 한 번 동의(질문이 Anthropic(미국)으로 전송·1년 기록)를 받은 뒤 AskChat 을 로그인 토큰으로 연다.
 * 서버 스위치가 꺼져 있으면 쉬는 중이라고만 보인다. 입력하는 동안은 떠 있는 탭 바를 숨겨 입력줄과 겹치지 않게 한다.
 */
export default function AskTabScreen() {
  const { status, accessToken, logout } = useAuth()
  const { navigation, showOnMap, routeTo, openSettings, searchNews } = useAskTabNavigation()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const loggedIn = status === 'authenticated' && !!accessToken
  const { consented, accept } = useAskConsent()
  const { askStatus, refreshStatus } = useAskStatus(loggedIn, accessToken)
  // 키보드가 올라오면 탭 바를 숨긴다(떠 있는 캡슐이 입력줄을 가린다). 이 탭을 떠나면 원래대로.
  const keyboardShown = useKeyboardOpen()
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: keyboardShown ? { display: 'none' } : TAB_BAR_BASE_STYLE })
  }, [navigation, keyboardShown])

  if (askStatus && !askStatus.enabled) {
    return (
      <AskNotice
        topInset={insets.top}
        icon="moon-outline"
        title="지금은 물어보기를 쉬고 있어요"
        body="곧 다시 열게요. 학교 공지는 소식 탭에서 볼 수 있어요."
      />
    )
  }

  if (!loggedIn) {
    return (
      <AskNotice
        topInset={insets.top}
        icon="chatbubble-ellipses-outline"
        title="학교 일, 물어보세요"
        body="휴학·수강·장학·시설처럼 학교 일을 물으면 학교 공식 안내를 찾아 답해요. 로그인하면 쓸 수 있어요."
        action={{ label: '로그인하러 가기', onPress: () => void logout() }}
      />
    )
  }

  if (consented === null) return <View style={tabStyles.root} />

  if (!consented) return <AskConsent topInset={insets.top} onAccept={accept} />

  // 남은 횟수는 보이지 않는다(11-01 사용자). 하루 한도에 닿으면 서버 429 문구가 답 자리에 뜬다.
  const note = askStatus?.soldOut ? '오늘 준비한 질문이 모두 찼어요. 내일 다시 물어봐 주세요.' : null

  return (
    <View style={tabStyles.root}>
      <AskChat
        accessToken={accessToken}
        beta
        bottomInset={keyboardShown ? insets.bottom : tabBarHeight}
        composerNote={note}
        onAsked={refreshStatus}
        onShowOnMap={showOnMap}
        onRouteTo={ROUTE_FINDING_ENABLED ? routeTo : undefined}
        onOpenSettings={openSettings}
        onSearchNews={searchNews}
      />
    </View>
  )
}
