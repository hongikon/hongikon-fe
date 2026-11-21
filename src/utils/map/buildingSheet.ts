import type { Facility, FacilityKind } from '../../types'
import { VISIBLE_FACILITY_KINDS } from '../../constants/facilityKinds'
import { formatFloor } from '../common/floors'

/** 종류 줄에 층을 이만큼까지만 적고 나머지는 '외'로 줄인다(홍문관 행정 부서처럼 층이 많은 경우). */
export const MAX_FLOORS_SHOWN = 4;

export interface KindRow {
  kind: FacilityKind;
  count: number;
  floors: number[];
}

/** 이 건물의 편의시설을 칩 순서대로 종류별로 묶는다. 칩에 없는 종류(엘리베이터)는 빼 칩 줄과 같은 목록을 쓴다(11-08). */
export function groupByKind(facilities: readonly Facility[]): KindRow[] {
  return VISIBLE_FACILITY_KINDS.flatMap(({ key }) => {
    const items = facilities.filter((f) => f.kind === key);
    if (items.length === 0) return [];
    const floors = [...new Set(items.flatMap((f) => (f.floor === undefined ? [] : [f.floor])))].sort((a, b) => a - b);
    return [{ kind: key, count: items.length, floors }];
  });
}

export function floorSummary(floors: number[]): string | null {
  if (floors.length === 0) return null;
  const shown = floors.slice(0, MAX_FLOORS_SHOWN).map(formatFloor).join(" · ");
  return floors.length > MAX_FLOORS_SHOWN ? `${shown} 외` : shown;
}
