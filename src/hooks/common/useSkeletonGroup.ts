import { useEffect, useRef } from 'react'
import { Animated, Platform } from 'react-native'
import { useReduceMotion } from './useReduceMotion'

/** SkeletonGroup 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useSkeletonGroup() {
  const pulse = useRef(new Animated.Value(1)).current
  const reduceMotion = useReduceMotion()

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1)
      return
    }
    const useNativeDriver = Platform.OS !== 'web'
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver }),
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse, reduceMotion])
  return { pulse }
}
