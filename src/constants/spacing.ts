/**
 * 여백·모서리·높이 단위. 화면마다 13·14·15 처럼 어긋나지 않게 이 값만 쓴다.
 * 4 의 배수가 기본이고, 화면 가장자리 여백은 SPACING.lg(16)로 맞춘다.
 */
export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

/** 화면 좌우 기본 여백 */
export const SCREEN_GUTTER = SPACING.lg

export const RADIUS = {
  /** 배지·작은 태그 */
  sm: 8,
  /** 버튼·입력칸·안내 상자 */
  md: 12,
  /** 카드·시트 */
  lg: 16,
  /** 칩·알약 모양 */
  pill: 999,
} as const

/** 누르는 것들의 높이. 44 는 터치 최소 크기(HIG)라 md 아래로는 hitSlop 을 함께 준다. */
export const CONTROL_HEIGHT = {
  sm: 36,
  md: 44,
  lg: 48,
} as const

/** 머리줄(뒤로 가기·제목) 높이와 그 안 아이콘 버튼 크기 */
export const HEADER_HEIGHT = 52
export const ICON_BUTTON_SIZE = 40

/** 아이콘 크기 단계 */
export const ICON_SIZE = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 22,
  /** 빈 화면 안내 */
  empty: 40,
  /** 완료 화면 체크 */
  hero: 44,
} as const
