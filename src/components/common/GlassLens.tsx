import { useEffect, useRef, useState } from 'react'
import { Animated, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'

/**
 * 고른 칸 뒤에 깔리는 알약(렌즈)과, 옮기거나 누르는 동안 그 위로 떠오르는 투명한 유리 방울(10-08).
 * 하단 탭 바와 소식 탭 세그먼트가 같이 쓴다.
 *
 * - 가라앉은 상태: 옅은 회색 알약이 고른 칸 뒤에 있다(`GlassLensBase` — 칸 아이콘·글자보다 아래에 그린다).
 * - 누르거나 다른 칸으로 옮길 때: 알약이 칸보다 크게 부푼 투명한 유리 방울이 돼(`GlassLensBubble` — 아이콘·글자 위에 그린다)
 *   새 칸까지 미끄러져 간 뒤 다시 작아지며 회색 알약으로 가라앉는다.
 * - 동작 줄이기가 켜져 있으면 부풀지 않고 바로 옮긴다.
 */
/** 움직임 세기. 'full' = 하단 탭 바(크게 부풀어 미끄러짐), 'subtle' = 소식 세그먼트(짧고 작게, 10-08 요청). */
type LensMotion = 'full' | 'subtle'

const MOTION = {
  // 하단 탭 바(10-08 조정): 부푸는 크기 1.18/1.36 → 1.03/1.08, 전체 1.25배 빠르게.
  // 스프링은 출렁이는 정도는 그대로 두고 속도만 올린다(stiffness ×1.5625, damping ×1.25). 시간 값은 ÷1.25.
  full: {
    slide: { damping: 25, stiffness: 312.5, mass: 0.9 },
    liftIn: 96,
    hold: 96,
    settle: { damping: 22.5, stiffness: 312.5 },
    grow: { x: 1.03, y: 1.08 },
  },
  // 소식 세그먼트(10-08 조정): 전체 1.25배 느리게 — stiffness ÷1.5625, damping ÷1.25(출렁임 정도는 그대로), 시간 ×1.25.
  subtle: {
    slide: { damping: 20.8, stiffness: 243.2, mass: 0.7 },
    liftIn: 88,
    hold: 0,
    settle: { damping: 17.6, stiffness: 204.8 },
    grow: { x: 1.06, y: 1.12 },
  },
} as const

export function useGlassLens(offset: number, ready = true, motion: LensMotion = 'full') {
  const reduceMotion = useReduceMotion()
  const m = MOTION[motion]
  const useNativeDriver = Platform.OS !== 'web'
  const translateX = useRef(new Animated.Value(offset)).current
  /** 0 = 가라앉은 회색 알약, 1 = 떠오른 유리 방울 */
  const lift = useRef(new Animated.Value(0)).current
  const placed = useRef(false)
  const pressing = useRef(false)
  /** 마지막으로 칸을 누른 시각. 누른 직후의 위치 변화만 애니메이션한다. */
  const lastPressAt = useRef(0)

  useEffect(() => {
    if (!ready) return
    // 처음 자리 잡을 때(폭을 처음 잴 때)·동작 줄이기·사용자가 누르지 않은 변화(다른 화면에서 돌아와 다시 그려질 때,
    // 알림으로 들어올 때, 폭이 바뀔 때 — 10-08 요청)에는 애니메이션 없이 바로 놓는다.
    const userInitiated = Date.now() - lastPressAt.current < 1000
    if (!placed.current || reduceMotion || !userInitiated) {
      placed.current = true
      translateX.setValue(offset)
      lift.setValue(0)
      return
    }
    // 이동과 부풀기는 따로 돌린다. parallel 로 묶으면 빠르게 다시 누를 때 부풀기(lift)가 끊기면서 이동까지 같이 멈춰
    // 알약이 탭 사이 어중간한 곳에 남았다(10-08). 이동은 끝까지 간다.
    Animated.spring(translateX, { toValue: offset, useNativeDriver, ...m.slide }).start()
    Animated.sequence([
      Animated.timing(lift, { toValue: 1, duration: m.liftIn, useNativeDriver }),
      Animated.delay(m.hold),
      Animated.spring(lift, { toValue: 0, useNativeDriver, ...m.settle }),
    ]).start(({ finished }) => {
      // 중간에 누름이 끼어들어 끊겼고 지금은 누르고 있지 않으면 가라앉힌다(방울이 떠 있는 채로 남지 않게).
      if (!finished && !pressing.current) Animated.spring(lift, { toValue: 0, useNativeDriver, ...m.settle }).start()
    })
  }, [offset, ready, reduceMotion, translateX, lift, useNativeDriver, m])

  /** 칸을 누르는 동안 유리 방울로 떠오르고, 떼면(옮기지 않았으면) 가라앉는다. */
  const setPressed = (down: boolean) => {
    if (down) lastPressAt.current = Date.now()
    if (reduceMotion || pressing.current === down) return
    pressing.current = down
    Animated.spring(lift, {
      toValue: down ? 1 : 0,
      useNativeDriver,
      damping: down ? 22 : m.settle.damping,
      stiffness: down ? 320 : m.settle.stiffness,
    }).start()
  }

  return { translateX, lift, setPressed, grow: m.grow }
}

type Lens = ReturnType<typeof useGlassLens>

interface LensProps {
  lens: Lens
  /** 위치·크기(position absolute, top/left/width/height/borderRadius). */
  style: StyleProp<ViewStyle>
}

/** 가라앉은 회색 알약. 칸 아이콘·글자보다 먼저(아래에) 그린다. 떠오르는 동안엔 흐려진다. */
export function GlassLensBase({ lens, style }: LensProps) {
  const opacity = lens.lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' })
  return (
    <Animated.View
      pointerEvents="none"
      style={[style, styles.base, { opacity, transform: [{ translateX: lens.translateX }, ...growTransforms(lens)] }]}
    />
  )
}

/** 떠오른 유리 방울. 칸 아이콘·글자 다음에(위에) 그린다 — 투명해서 아래 아이콘이 비친다. */
export function GlassLensBubble({ lens, style }: LensProps) {
  // 스프링이 0 아래로 살짝 넘쳤다 돌아오므로(-0.01 남짓) 불투명도는 0~1 로 묶는다.
  const opacity = lens.lift.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' })
  // 웹: 가라앉아 있는 동안(불투명도 ≈ 0)엔 방울을 아예 그리지 않는다. backdrop-filter·바깥 그림자가 있는 층은
  // 불투명도가 0 이어도 Chrome 이 지나간 자리에 옅은 회색 잔상을 남길 수 있었다(10-08 — '구독' 옆 회색 얼룩).
  const visible = useBubbleVisible(lens)
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        styles.bubble,
        !visible && styles.hidden,
        { opacity, transform: [{ translateX: lens.translateX }, ...growTransforms(lens)] },
      ]}
    />
  )
}

/** 웹에서만 lift 값을 지켜보며 방울이 떠 있는지(> 0.001) 알려 준다. 네이티브는 늘 true(그림자는 불투명도 0 이면 안 보인다). */
function useBubbleVisible(lens: Lens) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const id = lens.lift.addListener(({ value }) => setVisible(value > 0.001))
    return () => lens.lift.removeListener(id)
  }, [lens.lift])
  return Platform.OS !== 'web' || visible
}

/** 떠오를수록 칸보다 조금 크게 — 세로로 조금 더 부풀어 바 위아래로 아주 살짝 삐져나온다. */
function growTransforms(lens: Lens) {
  return [
    // 0 아래로 넘친 스프링 값에서 알약이 칸보다 작아지지 않게(위아래·좌우 틈이 4 보다 커지지 않게) 묶는다.
    { scaleX: lens.lift.interpolate({ inputRange: [0, 1], outputRange: [1, lens.grow.x], extrapolateLeft: 'clamp' }) },
    { scaleY: lens.lift.interpolate({ inputRange: [0, 1], outputRange: [1, lens.grow.y], extrapolateLeft: 'clamp' }) },
  ]
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  base: {
    backgroundColor: 'rgba(118,118,128,0.14)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.7), inset 0 0 0 0.5px rgba(0,0,0,0.04)' } as ViewStyle)
      : null),
  },
  bubble: {
    // 맑은 유리: 거의 투명한 흰색 + 밝은 테두리 + 떠 있는 그림자. 웹은 뒤를 살짝 밝고 진하게(굴절 느낌).
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    ...(Platform.OS !== 'web'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 6 }
      : ({
          backdropFilter: 'blur(1px) saturate(200%) brightness(1.08)',
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,1), inset 0 -1px 1px rgba(255,255,255,0.6), inset 0 0 8px rgba(255,255,255,0.5), 0 6px 18px rgba(0,0,0,0.14)',
        } as ViewStyle)),
  },
})
