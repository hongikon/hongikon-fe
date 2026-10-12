import { facilityKindLabel } from '../constants/facilityKinds'
import { formatFloor } from './floors'
import { normalize } from './normalize'
import type { Facility, FacilityKind } from '../types'

/** 검색 결과에 한 번에 보여 줄 편의시설 수. 한두 글자 검색에 수십 줄이 쏟아지지 않게. */
const MAX_RESULTS = 30

/**
 * 칩 이름에 없는 말로 찾을 때를 위한 별칭. '행정'·'인쇄'처럼 학생이 실제로 치는 말을 종류에 잇는다.
 * 부서 이름(교무처·학사지원팀 등)은 시설 메모(`note`)에 들어 있어 따로 적지 않는다.
 */
const KIND_ALIASES: Partial<Record<FacilityKind, readonly string[]>> = {
  프린터: ['인쇄', '복사', '출력', '프린트'],
  '증명서 발급': ['증명서', '발급기', '무인발급', '성적증명', '재학증명'],
  열람실: ['도서관', '독서실', '공부'],
  스터디룸: ['세미나실', '그룹스터디', '공부방'],
  정수기: ['물', '식수'],
  식당: ['학식', '학생식당', '밥'],
  라운지: ['휴게실', '휴게'],
  수면실: ['낮잠', '휴게'],
  학생처: ['행정', '행정실', '행정처', '학생지원', '장학', '사무처'],
  학과사무실: ['과사', '과사무실', '학과'],
  '행사·전시': ['전시', '미술관', '박물관', '갤러리'],
  흡연구역: ['흡연', '담배', '흡연장'],
  엘리베이터: ['승강기', '엘베'],
}

export interface FacilitySearchResult {
  facility: Facility
  /** 줄 제목. 메모 맨 앞 이름(예: '교무처')이 있으면 그것, 없으면 종류 이름. */
  title: string
  /** '행정·지원 · 홍문관 5F' 처럼 종류·건물·층. */
  subtitle: string
}

/** 메모 맨 앞이 부서·사무실 이름인 종류. 다른 종류의 메모는 '2층 복사실 옆' 같은 위치 설명이라 제목으로 쓰지 않는다. */
const NAMED_KINDS: ReadonlySet<FacilityKind> = new Set<FacilityKind>(['학생처', '학과사무실'])

/** 메모 '교무처 · 02-320-1032' 에서 맨 앞 이름만. */
function noteTitle(facility: Facility): string | null {
  if (!NAMED_KINDS.has(facility.kind)) return null
  const head = facility.note?.split('·')[0]?.trim()
  return head ? head : null
}

function searchableFields(facility: Facility): string[] {
  return [
    facility.kind,
    facilityKindLabel(facility.kind),
    ...(KIND_ALIASES[facility.kind] ?? []),
    facility.buildingName,
    facility.note ?? '',
  ]
}

/**
 * 편의시설 검색. 받아 둔 지도 데이터만 훑는다(네트워크 없음). 빈 검색어는 빈 배열.
 * 메모(부서명·위치 설명)가 걸린 것을 앞에, 종류·건물로만 걸린 것을 뒤에 둔다.
 */
export function searchFacilities(facilities: readonly Facility[], query: string): FacilitySearchResult[] {
  const q = normalize(query)
  if (!q) return []

  const scored = facilities
    .map((facility) => {
      const title = noteTitle(facility)
      const titleHit = normalize(facility.note ?? '').includes(q)
      const hit = titleHit || searchableFields(facility).some((field) => normalize(field).includes(q))
      return hit ? { facility, title, titleHit } : null
    })
    .filter((item): item is { facility: Facility; title: string | null; titleHit: boolean } => item !== null)

  return scored
    .sort((a, b) => Number(b.titleHit) - Number(a.titleHit))
    .slice(0, MAX_RESULTS)
    .map(({ facility, title }) => {
      const kindLabel = facilityKindLabel(facility.kind)
      const place = [facility.buildingName, facility.floor !== undefined ? formatFloor(facility.floor) : null]
        .filter(Boolean)
        .join(' ')
      return {
        facility,
        title: title ?? kindLabel,
        subtitle: [title ? kindLabel : null, place].filter(Boolean).join(' · '),
      }
    })
}
