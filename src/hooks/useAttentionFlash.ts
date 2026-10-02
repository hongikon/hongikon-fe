import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import { COLORS } from '../constants/colors'
import { useReduceMotion } from './useReduceMotion'

/** 빨간 테두리가 원래 색으로 돌아오기까지(ms). 처음 잠깐 빨갛게 머문 뒤 서서히 빠진다. */
const HOLD_MS = 250
const FADE_MS = 950
/** 좌우로 짧게 흔드는 폭(px)과 한 번 움직이는 시간(ms). */
const SHAKE_STEPS = [-6, 6, -4, 4, -2, 0]
const SHAKE_STEP_MS = 45

/**
 * 비워 둔 필수 칸에 시선을 모으는 효과. `flashKey` 가 바뀔 때마다 테두리를 빨갛게 했다가 ~1.2초에 걸쳐
 * 원래 색으로 되돌리고, 좌우로 살짝 흔든다. "동작 줄이기"가 켜져 있으면 흔들기는 빼고 색만 바꾼다.
 * `active` 가 false 가 되면(칸이 채워짐) 진행 중인 효과를 바로 멈추고 원래대로 둔다.
 *
 * 웹에서도 돌도록 JS 드라이버를 쓴다(색 보간은 네이티브 드라이버가 못 한다).
 */
export function useAttentionFlash(flashKey: number | undefined, active: boolean, baseColor: string) {
  const progress = useRef(new Animated.Value(0)).current
  const shake = useRef(new Animated.Value(0)).current
  const reduceMotion = useReduceMotion()

  useEffect(() => {
    if (!flashKey || !active) {
      progress.stopAnimation()
      shake.stopAnimation()
      progress.setValue(0)
      shake.setValue(0)
      return
    }
    progress.setValue(1)
    shake.setValue(0)
    const color = Animated.sequence([
      Animated.delay(HOLD_MS),
      Animated.timing(progress, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ])
    const animations = [color]
    if (!reduceMotion) {
      animations.push(
        Animated.sequence(
          SHAKE_STEPS.map((toValue) =>
            Animated.timing(shake, { toValue, duration: SHAKE_STEP_MS, easing: Easing.linear, useNativeDriver: false }),
          ),
        ),
      )
    }
    const running = Animated.parallel(animations)
    running.start()
    return () => running.stop()
    // reduceMotion 이 바뀌었다고 다시 흔들 필요는 없다 — 누른 순간(flashKey)에만 반응한다.
  }, [flashKey, active])

  const borderColor = progress.interpolate({ inputRange: [0, 1], outputRange: [baseColor, COLORS.danger] })
  return { borderColor, transform: [{ translateX: shake }] }
}
