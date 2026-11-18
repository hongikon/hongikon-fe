import { useCallback } from 'react'
import { BackHandler, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

/**
 * 지도 탭에 있는 동안 안드로이드 뒤로가기(웹은 Esc)를 closeTopLayer 로 보낸다. closeTopLayer 가 무언가 닫았으면 true 를
 * 돌려주고, 닫을 게 없으면 false — 그러면 기본 동작(앱 나가기 등)에 맡긴다.
 * 웹 Esc 는 입력 칸에서 누른 것이나 이미 처리된 것은 건드리지 않는다(검색·작성창이 먼저 닫히게).
 */
export function useMapBackHandler(closeTopLayer: () => boolean) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        const sub = BackHandler.addEventListener('hardwareBackPress', closeTopLayer)
        return () => sub.remove()
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const onKey = (e: KeyboardEvent) => {
          if (e.key !== 'Escape' || e.defaultPrevented) return
          const target = e.target as HTMLElement | null
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
          if (closeTopLayer()) e.preventDefault()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }
      return undefined
    }, [closeTopLayer]),
  )
}
