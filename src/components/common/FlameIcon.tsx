import { memo } from 'react'
import Svg, { Path } from 'react-native-svg'
import { COLORS } from '../../constants/colors'

/**
 * 홍익온 🔥(불) 아이콘 — `ui-shots/fire-icon/FINAL.md` 그대로. 확성기 불꽃(시안 B)을 세운 모양, viewBox `0 4 64 52`.
 *
 * - outline: 안 누른 🔥 버튼. 바깥 모양만 외곽선(#05014A, stroke 5).
 * - full:    누른 🔥 버튼. 바깥 #0B1A8C + 아래 그림자 #05014A(.45) + 안쪽 흰색.
 * - hot:     HOT 배지 안. 바깥 #4C63FF + 안쪽 흰색(배지 바탕 #05014A).
 * - marker:  지도 마커(흰 원 위). 바깥 #0B1A8C + 안쪽 흰색. 지도 페이지(mapHtml.ts)는 같은 경로를 문자열로 쓴다.
 */
export const FLAME_VIEWBOX = '0 4 64 52'
export const FLAME_OUTER =
  'M32 3c4 10 16 15 16 30 0 10-7 18-16 18s-16-8-16-18c0-8 5-12 7-18 2 5 4 7 7 8-1-8 0-13 2-20z'
export const FLAME_INNER =
  'M31 25c3 6 8 9 8 16 0 5-3 8-7 8s-7-3-7-8c0-4 2-6 3-9 1 2 2 3 4 4-1-4-1-8-1-11z'
export const FLAME_SHADE =
  'M32 51c-9 0-16-8-16-18 0-2 0-3 1-5 2 9 8 15 15 15s13-6 15-15c1 2 1 3 1 5 0 10-7 18-16 18z'

export type FlameVariant = 'outline' | 'full' | 'hot' | 'marker'

interface FlameIconProps {
  variant?: FlameVariant
  size?: number
}

function FlameIcon({ variant = 'full', size = 20 }: FlameIconProps) {
  return (
    <Svg width={size} height={size} viewBox={FLAME_VIEWBOX} accessibilityElementsHidden importantForAccessibility="no">
      {variant === 'outline' ? (
        <Path d={FLAME_OUTER} fill="none" stroke={COLORS.fireShade} strokeWidth={5} strokeLinejoin="round" />
      ) : (
        <>
          <Path d={FLAME_OUTER} fill={variant === 'hot' ? COLORS.hotFlame : COLORS.fire} />
          {variant === 'full' ? <Path d={FLAME_SHADE} fill={COLORS.fireShade} opacity={0.45} /> : null}
          <Path d={FLAME_INNER} fill={COLORS.white} />
        </>
      )}
    </Svg>
  )
}

export default memo(FlameIcon)
