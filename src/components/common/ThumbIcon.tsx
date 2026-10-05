import { memo } from 'react'
import Svg, { Path } from 'react-native-svg'
import { COLORS } from '../../constants/colors'

/**
 * 홍익온 댓글 좋아요 아이콘(엄지). 이모지·시스템 글꼴 대신 자체 경로로 그려 기기마다 모양이 같다(이모지 금지 원칙).
 * - outline: 안 누른 상태. 회색 외곽선.
 * - filled:  누른 상태. 메인 컬러로 채운다.
 * viewBox 24. 왼쪽 손목 칸 + 오른쪽 엄지·손바닥.
 */
const WRIST = 'M3.5 10.5h3v9.5h-3a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1z'
const HAND =
  'M6.5 10.5 10.4 3.6a1.9 1.9 0 0 1 3.5 1.2l-.7 4.7h5.6a2 2 0 0 1 2 2.4l-1.3 6.4a2 2 0 0 1-2 1.7H6.5z'

function ThumbIcon({ variant = 'outline', size = 14 }: { variant?: 'outline' | 'filled'; size?: number }) {
  const filled = variant === 'filled'
  const color = filled ? COLORS.primary : COLORS.textSecondary
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={WRIST} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d={HAND} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  )
}

export default memo(ThumbIcon)
