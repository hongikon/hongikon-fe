import { useEffect, useRef } from 'react'
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
export function useGlassLens(offset: number, ready = true) {
  const reduceMotion = useReduceMotion()
  const useNativeDriver = Platform.OS !== 'web'
  const translateX = useRef(new Animated.Value(offset)).current
  /** 0 = 가라앉은 회색 알약, 1 = 떠오른 유리 방울 */
  const lift = useRef(new Animated.Value(0)).current
  const placed = useRef(false)
  const pressing = useRef(false)

  useEffect(() => {
    if (!ready) return
    // 처음 자리 잡을 때(폭을 처음 잴 때)와 동작 줄이기에선 애니메이션 없이 놓는다.
    if (!placed.current || reduceMotion) {
      placed.current = true
      translateX.setValue(offset)
      lift.setValue(0)
      return
    }
    // 이동과 부풀기는 따로 돌린다. parallel 로 묶으면 빠르게 다시 누를 때 부풀기(lift)가 끊기면서 이동까지 같이 멈춰
    // 알약이 탭 사이 어중간한 곳에 남았다(10-08). 이동은 끝까지 간다.
    Animated.spring(translateX, { toValue: offset, useNativeDriver, damping: 20, stiffness: 200, mass: 0.9 }).start()
    Animated.sequence([
      Animated.timing(lift, { toValue: 1, duration: 120, useNativeDriver }),
      Animated.delay(120),
      Animated.spring(lift, { toValue: 0, useNativeDriver, damping: 14, stiffness: 180 }),
    ]).start(({ finished }) => {
      // 중간에 누름이 끼어들어 끊겼고 지금은 누르고 있지 않으면 가라앉힌다(방울이 떠 있는 채로 남지 않게).
      if (!finished && !pressing.current) Animated.spring(lift, { toValue: 0, useNativeDriver, damping: 14, stiffness: 180 }).start()
    })
  }, [offset, ready, reduceMotion, translateX, lift, useNativeDriver])

  /** 칸을 누르는 동안 유리 방울로 떠오르고, 떼면(옮기지 않았으면) 가라앉는다. */
  const setPressed = (down: boolean) => {
    if (reduceMotion || pressing.current === down) return
    pressing.current = down
    Animated.spring(lift, {
      toValue: down ? 1 : 0,
      useNativeDriver,
      damping: down ? 22 : 14,
      stiffness: down ? 320 : 180,
    }).start()
  }

  return { translateX, lift, setPressed }
}

type Lens = ReturnType<typeof useGlassLens>

interface LensProps {
  lens: Lens
  /** 위치·크기(position absolute, top/left/width/height/borderRadius). */
  style: StyleProp<ViewStyle>
}

/** 가라앉은 회색 알약. 칸 아이콘·글자보다 먼저(아래에) 그린다. 떠오르는 동안엔 흐려진다. */
export function GlassLensBase({ lens, style }: LensProps) {
  const opacity = lens.lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
  return (
    <Animated.View
      pointerEvents="none"
      style={[style, styles.base, { opacity, transform: [{ translateX: lens.translateX }, ...growTransforms(lens)] }]}
    />
  )
}

/** 떠오른 유리 방울. 칸 아이콘·글자 다음에(위에) 그린다 — 투명해서 아래 아이콘이 비친다. */
export function GlassLensBubble({ lens, style }: LensProps) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[style, styles.bubble, { opacity: lens.lift, transform: [{ translateX: lens.translateX }, ...growTransforms(lens)] }]}
    />
  )
}

/** 떠오를수록 칸보다 크게 — 세로로 더 많이 부풀어 바 위아래로 살짝 삐져나온다. */
function growTransforms(lens: Lens) {
  return [
    { scaleX: lens.lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
    { scaleY: lens.lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.36] }) },
  ]
}

const styles = StyleSheet.create({
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
