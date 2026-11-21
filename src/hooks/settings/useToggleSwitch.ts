import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import { COLORS } from '../../constants/colors'
import { useReduceMotion } from '../common/useReduceMotion'
import { SIZE, PADDING, STRETCH } from '../../utils/settings/toggleSwitch'
import type { ToggleSwitchProps } from '../../components/settings/ToggleSwitch'

/** ToggleSwitch 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useToggleSwitch({ value }: Pick<ToggleSwitchProps, 'value'>) {
  const { width, height, thumb } = SIZE
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current
  const press = useRef(new Animated.Value(0)).current
  const reduceMotion = useReduceMotion()

  const setPressed = (down: boolean) => {
    if (reduceMotion) return
    Animated.spring(press, { toValue: down ? 1 : 0, useNativeDriver: false, speed: 28, bounciness: down ? 0 : 6 }).start()
  }

  useEffect(() => {
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      speed: 22,
      bounciness: 4,
    }).start()
  }, [value, progress])

  const travel = width - thumb - PADDING * 2
  // 늘어날 때 켜짐 쪽(오른쪽)에선 왼쪽으로 늘어나야 트랙 밖으로 나가지 않는다.
  const translateX = Animated.subtract(
    progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }),
    Animated.multiply(progress, press.interpolate({ inputRange: [0, 1], outputRange: [0, STRETCH] })),
  )
  const thumbWidth = press.interpolate({ inputRange: [0, 1], outputRange: [thumb, thumb + STRETCH] })
  const thumbColor = press.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,1)', 'rgba(255,255,255,0.6)'],
  })
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.toggleOff, COLORS.primary],
  })
  return { width, height, thumb, setPressed, translateX, thumbWidth, thumbColor, backgroundColor }
}
