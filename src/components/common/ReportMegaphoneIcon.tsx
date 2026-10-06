import { memo } from 'react'
import Svg, { Path } from 'react-native-svg'
import {
  BRAND_MEGAPHONE_BODY,
  BRAND_MEGAPHONE_SHADE,
  BRAND_MEGAPHONE_SHADE_OPACITY,
  BRAND_MEGAPHONE_VIEWBOX,
} from '../../constants/brandMegaphone'

/** 제보 아이콘 — 홍익온 로고의 말풍선 확성기(`brandMegaphone.ts`). 색은 제보 색(메인 컬러)이나 흰색을 넘긴다. */
function ReportMegaphoneIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={BRAND_MEGAPHONE_VIEWBOX} accessibilityElementsHidden importantForAccessibility="no">
      <Path d={BRAND_MEGAPHONE_BODY} fill={color} />
      <Path d={BRAND_MEGAPHONE_SHADE} fill="#000000" fillOpacity={BRAND_MEGAPHONE_SHADE_OPACITY} />
    </Svg>
  )
}

export default memo(ReportMegaphoneIcon)
