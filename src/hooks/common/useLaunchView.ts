import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from './useReduceMotion'
import type { Props } from '../../components/common/LaunchView'

/** LaunchView 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useLaunchView({ progress }: Pick<Props, 'progress'>) {
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const sweep = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (progress || reduceMotion) return
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    )
    loop.start()
    return () => loop.stop()
  }, [progress, reduceMotion, sweep])
  return { insets, reduceMotion, sweep }
}
