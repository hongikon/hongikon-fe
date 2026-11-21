import { useCallback } from 'react'
import { Keyboard } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { requestMapIntent } from '../../lib/mapIntents'
import { requestSettingsIntent } from '../../lib/settingsIntents'

/** 물어보기 탭 답의 버튼이 다른 탭·화면으로 옮기는 일. 모두 키보드를 먼저 내린다. 콜백 참조는 navigation 이 바뀔 때만 바뀐다. */
export function useAskTabNavigation() {
  const navigation = useNavigation()
  // 답의 "지도에서 보기"(11-07): 지도 탭에 요청을 넘기고 옮긴다 — 지도 탭이 포커스될 때 꺼내 핀·시트·설명 카드를 띄운다.
  const showOnMap = useCallback(
    (place: { target: string; title?: string; summary?: string }) => {
      Keyboard.dismiss()
      requestMapIntent({ type: 'focusPlace', ...place })
      navigation.navigate('Map' as never)
    },
    [navigation],
  )
  // 답의 길찾기 버튼(11-09): 지도 탭에서 그 곳을 도착으로 길찾기를 연다. 출발은 질문의 출발 건물(11-15), 없으면 내 위치.
  const routeTo = useCallback(
    (place: { target: string; from?: string }) => {
      Keyboard.dismiss()
      requestMapIntent({ type: 'routeTo', target: place.target, from: place.from })
      navigation.navigate('Map' as never)
    },
    [navigation],
  )
  // '알림 설정 어떻게 해'(11-09): 설정 탭으로 옮겨 그 화면을 연다(바꾸지는 않는다).
  const openSettings = useCallback(
    (screen: 'alerts' | 'subscriptions') => {
      Keyboard.dismiss()
      requestSettingsIntent({ type: screen === 'alerts' ? 'openAlerts' : 'openSubscriptions' })
      navigation.navigate('Settings' as never)
    },
    [navigation],
  )
  // '○○ 공지 찾아줘'(11-09): 소식 게시글 검색을 그 말로 연다(루트 스택 화면).
  const searchNews = useCallback(
    (query: string) => {
      Keyboard.dismiss()
      ;(navigation as unknown as { navigate: (name: string, params: object) => void }).navigate('NewsSearch', { query })
    },
    [navigation],
  )
  return { navigation, showOnMap, routeTo, openSettings, searchNews }
}
