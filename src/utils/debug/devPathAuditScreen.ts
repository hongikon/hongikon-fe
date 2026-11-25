/** 지도 위 점 색 — 목록 머리줄 색과 같다. */
export const KIND_COLOR = {
  broken: '#B91C1C',
  isolated: '#DC2626',
  detached: '#EA580C',
  entrance: '#7C3AED',
  building: '#475569',
} as const

export type Kind = keyof typeof KIND_COLOR
