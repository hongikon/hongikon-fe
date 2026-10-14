import type { Facility, FacilityKind } from '../types'

/**
 * 서버 데이터가 따라오기 전까지 앱이 먼저 바로잡아 보여 주는 시설 값(10-15).
 * `from` 종류로 내려오면 `to` 로 바꿔 보여 준다. 서버가 이미 바뀐 값(다른 종류)을 주면 건드리지 않는다 — 서버 SQL 이 돌면 저절로 서버 값을 쓴다.
 * 서버 반영을 확인하면 그 항목을 지운다.
 */
interface FacilityOverride {
  from: FacilityKind
  to: FacilityKind
  note: string
}

export const FACILITY_OVERRIDES: Record<string, FacilityOverride> = {
  // 신한은행 홍익대학교 지점. 서버에는 '학생처'(행정·지원)로 들어가 있다. 서버 쪽은 hongikon-be db/sync_facilities_2026_10_14_bank.sql.
  // 출처: 홍익대 편의시설 페이지(/kr/life/facility.do, 10-15 확인) — 홍문관(R동) 로비층.
  'hi-r-1f-office-04': {
    from: '학생처',
    to: '은행·ATM',
    note: '신한은행 홍익대학교 지점 · 창구 평일 09:00~16:00 · ATM 07:00~23:30 · 유어스마트라운지 평일 09:00~21:00, 주말·공휴일 12:00~18:00 · 02-6023-3950',
  },
}

export function applyFacilityOverride(facility: Facility): Facility {
  const o = FACILITY_OVERRIDES[facility.id]
  if (!o || facility.kind !== o.from) return facility
  return { ...facility, kind: o.to, note: o.note }
}
