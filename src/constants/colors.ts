/**
 * 앱 공용 색. 화면에서 '#888' 같은 hex 를 직접 쓰지 말고 여기 이름으로 쓴다.
 *
 * 글자색은 흰 바탕 기준 WCAG AA(작은 글씨 4.5:1)를 넘게 잡았다.
 * - textPrimary   #111111  18.9:1  본문·제목
 * - textSecondary #666666   5.7:1  설명·보조 문구
 * - textTertiary  #767676   4.5:1  날짜·개수·값처럼 가장 옅은 글자(이보다 옅은 회색 글자는 쓰지 않는다)
 * 회색 바탕(background #F2F2F2) 위에서도 textSecondary 는 5.2:1, textTertiary 는 4.1:1 이다.
 *
 * 아이콘·선처럼 글자가 아닌 것은 대비 기준이 3:1(꾸밈용은 기준 없음)이라 따로 둔다.
 */
export const COLORS = {
  primary: '#05014A',
  /** 브랜드색을 옅게 깐 바탕. 보조 버튼·선택된 항목·아이콘 받침에 쓴다. */
  primarySoft: '#EEF0FA',

  /** 목록·설정처럼 카드가 얹히는 화면 바탕 */
  background: '#F2F2F2',
  /** @deprecated background 와 같다. 예전 이름이라 남겨 둔다. */
  sectionBg: '#F2F2F2',
  white: '#FFFFFF',
  cardBg: '#FFFFFF',
  /** 입력칸·아이콘 버튼처럼 흰 바탕 위에 살짝 들어간 면 */
  fill: '#F4F4F4',

  /** 카드·입력칸 테두리 */
  border: '#E8E8E8',
  /** 목록 줄 사이 가는 구분선 */
  divider: '#F0F0F0',

  textPrimary: '#111111',
  textSecondary: '#666666',
  textTertiary: '#767676',
  textPlaceholder: '#9A9A9A',

  /** 꺼진 아이콘·빈 화면 아이콘처럼 꾸밈에 가까운 아이콘 */
  iconMuted: '#BDBDBD',
  /** 누를 수 있는 줄 끝의 > 표시 */
  chevron: '#C4C4C4',
  iconInactive: '#8A8A8A',

  chipBorder: '#E2E2E2',
  chipText: '#555555',

  routeFrom: '#16A34A',
  routeTo: '#1E40AF',
  routeLine: '#1E40AF',

  danger: '#DC2626',
  dangerSoft: '#FDECEC',
  success: '#15803D',
  successSoft: '#E8F6EE',
  /** 주의 안내(노란 상자) 글자·아이콘·바탕 */
  warning: '#92400E',
  warningIcon: '#B45309',
  warningSoft: '#FEF3C7',

  toggleOff: '#D4D4D4',
  /**
   * 🔥(불) 공감 — ui-shots/fire-icon/FINAL.md. 불꽃 바깥 #0B1A8C, 아래 그림자 #05014A(.45), 안쪽 흰색.
   * 버튼: 안 누름은 회색 테두리 1.5px(fireChipBorder), 누름은 fire 2px. HOT 배지 바탕은 primary, 불꽃은 hotFlame.
   */
  fire: '#0B1A8C',
  fireShade: '#05014A',
  fireChipBorder: '#DFE2EC',
  hotFlame: '#4C63FF',
  /** 반투명 검은 막(모달 뒤) */
  scrim: 'rgba(0,0,0,0.45)',
} as const

export const CATEGORY_COLORS = {
  공지: { bg: '#FEE2E2', text: '#B91C1C' },
  장학: { bg: '#D1FAE5', text: '#065F46' },
  행사: { bg: '#FEF3C7', text: '#92400E' },
  수강: { bg: '#DBEAFE', text: '#1E40AF' },
  시설: { bg: '#EDE9FE', text: '#5B21B6' },
  취업: { bg: '#FFF7ED', text: '#C2410C' },
  상담: { bg: '#F0FDF4', text: '#166534' },
} as const

export type CategoryKey = keyof typeof CATEGORY_COLORS
