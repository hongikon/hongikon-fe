import { useContext, useEffect, type RefObject } from 'react'
import { Keyboard, Platform, TextInput, type View } from 'react-native'
import { AdminScrollContext } from './host'

/** 키보드 윗변과 확인 막대 사이에 남길 여백 */
const KEYBOARD_REVEAL_GAP = 12

/**
 * 앱(iOS·Android)에서 키보드가 올라오면, 포커스된 입력칸이 `box` 안에 있을 때 `box` 전체(입력칸 + 버튼)가
 * 키보드 위로 보이도록 스크롤한다. 키보드가 이미 떠 있는 채로 열려도(다른 칸에서 넘어옴) 한 번 맞춘다.
 */
export function useRevealAboveKeyboard(box: RefObject<View | null>, enabled: boolean): void {
  const scroll = useContext(AdminScrollContext)
  useEffect(() => {
    if (!enabled || !scroll || Platform.OS === 'web') return
    let cancelled = false
    const reveal = (keyboardTop: number) => {
      const focused = TextInput.State.currentlyFocusedInput()
      const target = box.current
      if (!focused || !target) return
      target.measureInWindow((_x, y, _w, height) => {
        focused.measureInWindow((_fx, focusedY) => {
          if (cancelled || focusedY < y || focusedY > y + height) return
          const overflow = y + height + KEYBOARD_REVEAL_GAP - keyboardTop
          if (overflow > 0) scroll.scrollBy(overflow)
        })
      })
    }
    const subscription = Keyboard.addListener('keyboardDidShow', (event) => reveal(event.endCoordinates.screenY))
    const metrics = Keyboard.isVisible() ? Keyboard.metrics() : undefined
    const timer = metrics ? setTimeout(() => reveal(metrics.screenY), 250) : null
    return () => {
      cancelled = true
      subscription.remove()
      if (timer) clearTimeout(timer)
    }
  }, [box, enabled, scroll])
}
