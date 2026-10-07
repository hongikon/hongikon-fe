import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet } from 'react-native'
import { COLORS } from '../../constants/colors'
import * as haptics from '../../lib/haptics'
import { useReduceMotion } from '../../hooks/useReduceMotion'

interface ToggleSwitchProps {
  value: boolean
  onToggle: () => void
  accessibilityLabel: string
  /** 전체 알림이 꺼져 있을 때처럼 "눌러도 지금은 효과가 없다"를 보여줄 때. 누를 수는 있다. */
  dimmed?: boolean
  /** 눌러도 값이 바뀌지 않는 스위치(게스트 — 누르면 로그인 안내). 켜짐 진동을 내지 않는다. */
  locked?: boolean
}

/** 앱 전체에서 스위치는 이 한 가지 크기만 쓴다(화면마다 크기가 달라 보이지 않게). */
const SIZE = { width: 44, height: 26, thumb: 22 } as const
const PADDING = 2
/** 누르고 있는 동안 손잡이가 늘어나는 길이. */
const STRETCH = 8

/**
 * 설정 화면 공용 스위치. 썸이 순간이동하지 않고 미끄러지게 움직인다(docs/settings-ui-upgrade.md 7번).
 * RN 기본 Switch 는 플랫폼마다 모양이 달라 웹·iOS·Android 를 같은 모양으로 맞추려고 직접 그린다.
 * 유리 기조(10-07 — 탭 바 렌즈·세그먼트와 같은 결): 손잡이에 흰 테두리 윤을 두고, 누르고 있는 동안
 * 손잡이가 옆으로 늘어나며 반투명 유리 렌즈가 됐다가 떼면 돌아온다. 동작 줄이기면 늘어나지 않는다.
 */
export default function ToggleSwitch({
  value,
  onToggle,
  accessibilityLabel,
  dimmed = false,
  locked = false,
}: ToggleSwitchProps) {
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

  return (
    <Pressable
      onPress={() => {
        // 꺼짐 → 켜짐으로 바꿀 때만 무음 스위치처럼 두 박자로 진동한다(끌 때는 조용히).
        if (!value && !locked) haptics.switchOn()
        onToggle()
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
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
            {
              width: thumbWidth,
              height: thumb,
              borderRadius: thumb / 2,
              backgroundColor: thumbColor,
              transform: [{ translateX }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: { justifyContent: 'center', paddingHorizontal: PADDING },
  thumb: {
    // 유리 윤: 흰 테두리(렌즈가 되면 가장자리로 보인다).
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  dimmed: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
})
