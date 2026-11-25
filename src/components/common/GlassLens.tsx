import { Animated, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { type Lens, useBubbleVisible } from '../../hooks/common/useBubbleVisible'
import { growTransforms } from '../../utils/common/glassLens'

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
