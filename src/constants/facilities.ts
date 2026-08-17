import type { Facility } from '../types'

/**
 * 캠퍼스 편의시설 목록.
 *
 * `buildings.ts` 와 같은 규칙을 따른다 — 위치를 확인받기 전에는 목록에 넣지
 * 않는다. 편의시설은 건물 안에 있어 자체 좌표를 확인할 방법이 없으므로,
 * 좌표 대신 `buildingName` 으로 이미 검증된 건물 좌표를 가리킨다.
 * 지도 핀은 그 건물 좌표에 찍힌다.
 *
 * 한 건물에 같은 종류가 여러 층에 있으면 층마다 따로 넣는다. 지도에서는
 * 좌표가 같아 핀이 겹치므로, `utils/facilities.ts` 가 건물 단위로 묶어
 * "홍문관 R동 2F·4F" 처럼 한 핀에 층을 모아 보여준다.
 *
 * `buildingName` 은 `BUILDINGS` 의 `name` 과 정확히 일치해야 한다.
 * 오타로 못 찾은 항목은 조용히 사라지지 않고 개발 중 경고로 드러난다
 * (`utils/facilities.ts` 의 `unresolvedFacilities` 참고).
 *
 * 예시(실제 값 아님):
 *   { id: 'printer-hongmun-2f', kind: '프린터', buildingName: '홍문관 R동', floor: 2 }
 */
export const FACILITIES: readonly Facility[] = []
