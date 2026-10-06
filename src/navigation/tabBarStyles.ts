import { COLORS } from '../constants/colors'

/** 아래 탭 막대 기본 모양(소식·설정 등). */
export const TAB_BAR_BASE_STYLE = {
  height: 82,
  paddingTop: 8,
  backgroundColor: COLORS.white,
  borderTopWidth: 0.5,
  borderTopColor: COLORS.border,
}

/**
 * 지도 화면만 탭바를 지도 위에 띄운다(position:absolute) — 그래야 지도가 화면 맨 아래까지 깔린다.
 */
export const MAP_TAB_BAR_STYLE = { ...TAB_BAR_BASE_STYLE, position: 'absolute' as const, left: 0, right: 0, bottom: 0 }
