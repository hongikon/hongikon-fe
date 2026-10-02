import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet } from 'react-native'
import { COLORS } from '../../constants/colors'

interface ToggleSwitchProps {
  value: boolean
  onToggle: () => void
  accessibilityLabel: string
  /** 전체 알림이 꺼져 있을 때처럼 "눌러도 지금은 효과가 없다"를 보여줄 때. 누를 수는 있다. */
  dimmed?: boolean
}

/** 앱 전체에서 스위치는 이 한 가지 크기만 쓴다(화면마다 크기가 달라 보이지 않게). */
const SIZE = { width: 44, height: 26, thumb: 22 } as const
const PADDING = 2

/**
 * 설정 화면 공용 스위치. 썸이 순간이동하지 않고 미끄러지게 움직인다(docs/settings-ui-upgrade.md 7번).
 * RN 기본 Switch 는 플랫폼마다 모양이 달라 웹·iOS·Android 를 같은 모양으로 맞추려고 직접 그린다.
 */
export default function ToggleSwitch({
  value,
  onToggle,
  accessibilityLabel,
  dimmed = false,
}: ToggleSwitchProps) {
  const { width, height, thumb } = SIZE
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      speed: 22,
      bounciness: 4,
    }).start()
  }, [value, progress])

  const travel = width - thumb - PADDING * 2
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel] })
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.toggleOff, COLORS.primary],
  })

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      style={({ pressed }) => [dimmed && styles.dimmed, pressed && styles.pressed]}
    >
      <Animated.View
        style={[styles.track, { width, height, borderRadius: height / 2, backgroundColor }]}
      >
        <Animated.View
          style={[
            styles.thumb,
            { width: thumb, height: thumb, borderRadius: thumb / 2, transform: [{ translateX }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: { justifyContent: 'center', paddingHorizontal: PADDING },
  thumb: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  dimmed: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
})
