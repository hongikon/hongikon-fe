import type { ReportCategory } from '../../types'

/** 제보는 지도에 늘 켜 둔다(10-27) — 끄는 스위치 없이 종류·HOT 만 고른다. */
export interface ReportFilterProps {
  /** 칩으로 그릴 종류(순서대로). */
  categories: readonly ReportCategory[]
  /** 지금 보이는 종류. 모두 들어 있으면 거르지 않는다. */
  selected: ReadonlySet<ReportCategory>
  onToggleCategory: (category: ReportCategory) => void
  hotOn: boolean
  /** 서버가 🔥 를 모르면 HOT 칩을 그리지 않는다. */
  hotAvailable: boolean
  onToggleHot: () => void
}

/** 전부 보는 기본 상태가 아니면(일부 종류·HOT 만) 메뉴 버튼에 점을 찍는다 — 닫힌 메뉴만 봐도 걸러 보는 중인 걸 알게. */
export function isNarrowed(filter: ReportFilterProps): boolean {
  return filter.hotOn || filter.categories.some((key) => !filter.selected.has(key))
}
