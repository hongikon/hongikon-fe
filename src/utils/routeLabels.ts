import type { RouteAlternative } from '../apis/routes'

/** 길찾기 후보 카드 하나에 보여 줄 것(11-09). */
export interface RouteOptionText {
  /** "가장 빠른 길", "T동 거쳐", "실내로 가는 길", "다른 길". */
  label: string
  /** 가장 빠른 길보다 얼마나 더 걸리는지. 30초 안이면 "비슷해요", 가장 빠른 길이면 null. */
  delta: string | null
  /** 짧은 특징: 계단·엘리베이터. */
  tags: string[]
}

/** 실내로 이만큼 더 걸으면(비 오는 날 등) '실내로 가는 길'이라 부른다. */
const INDOOR_EXTRA_METERS = 40

/** "제4공학관 T동" → "T동". 끝이 '○동'이 아니면 이름 그대로. */
export function shortBuildingName(name: string): string {
  const last = name.trim().split(/\s+/).pop() ?? name
  return /^[A-Z0-9]+동$/.test(last) ? last : name
}

/**
 * 후보마다 이름을 붙인다. 첫 번째(가장 빠른 길)를 기준으로, 무엇이 다른지가 이름이 된다 — 다른 건물 안을 지나는지,
 * 실내를 더 걷는지. 같은 이름이 둘이면 뒤의 것은 '다른 길'로 돌린다.
 */
export function describeRoutes(routes: readonly RouteAlternative[]): RouteOptionText[] {
  const best = routes[0]
  if (!best) return []
  const labels = routes.map((route, index) => {
    if (index === 0) return '가장 빠른 길'
    const via = route.viaBuildings?.find((name) => !(best.viaBuildings ?? []).includes(name))
    if (via) return `${shortBuildingName(via)} 거쳐`
    if ((route.indoorMeters ?? 0) >= (best.indoorMeters ?? 0) + INDOOR_EXTRA_METERS) return '실내로 가는 길'
    if (route.usesElevator && !best.usesElevator) return '엘리베이터 타는 길'
    return '다른 길'
  })
  const unique = labels.map((label, index) => (labels.indexOf(label) !== index ? '다른 길' : label))
  return routes.map((route, index) => {
    const extra = route.totalSeconds - best.totalSeconds
    const tags: string[] = []
    if (route.hasStairs) tags.push('계단 있음')
    if (route.usesElevator) tags.push('엘리베이터')
    if (route.notes?.some((note) => note.includes('주말'))) tags.push('주말엔 닫히는 곳 있음')
    return {
      label: unique[index],
      delta: index === 0 ? null : extra < 30 ? '비슷해요' : `+${Math.max(1, Math.round(extra / 60))}분`,
      tags,
    }
  })
}
