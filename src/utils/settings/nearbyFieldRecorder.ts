import { type FieldEntry } from '../../lib/nearbyPartners/fieldRecord'

/** 측정 중에 화면을 새로 그리는 간격. */
export const REFRESH_MS = 3_000

/** 정답 버튼으로 보여 줄 가까운 가게 수. */
export const SHOP_CHOICES = 6

export interface Shop {
  id: string
  name: string
  meters: number | null
}

export function describe(e: FieldEntry): string {
  if (e.k === 'truth') return `정답: ${e.name} ${e.ev === 'enter' ? '들어감' : '나옴'}`
  if (e.k === 'note') return e.text
  const near = e.nearName && e.nearM !== undefined ? ` · ${e.nearName} ${Math.round(e.nearM)}m` : ''
  const alert = e.alert ? ' · 알림 보냄' : ''
  return `${e.src} 오차 ${e.acc === null ? '?' : Math.round(e.acc)}m${near}${e.inside.length > 0 ? ` · 머무는 중 ${e.inside.length}` : ''}${alert}`
}
