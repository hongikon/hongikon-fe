export const COLORS = {
  primary: '#05014A',
  background: '#F2F2F2',
  white: '#FFFFFF',
  border: '#E8E8E8',
  textPrimary: '#111111',
  textSecondary: '#888888',
  textTertiary: '#BBBBBB',
  textPlaceholder: '#C0C0C0',
  chipBorder: '#E2E2E2',
  chipText: '#666666',
  iconInactive: '#C0C0C0',
  routeFrom: '#16A34A',
  routeTo: '#1E40AF',
  routeLine: '#1E40AF',
  danger: '#DC2626',
  toggleOff: '#DDDDDD',
  sectionBg: '#F0F0F0',
  cardBg: '#FFFFFF',
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
