import { test } from 'node:test'
import assert from 'node:assert/strict'

import { facilityUnavailableText, isFacilityUnavailable } from '../../src/utils/map/facilityStatus'
import { facilityMarkers } from '../../src/utils/map/facilities'
import { parseTermInput, termLabel, termPhase, termToInput } from '../../src/admin/utils/common/term'
import { buildRoadInput, buildRoadMap, edgeKey, emptyRoadDraft, filterEntrances, pickAt } from '../../src/admin/utils/roads/roadMap'
import type { Building, Facility } from '../../src/types'
import type { AdminWalkGraph } from '../../src/admin/types'

test('facilityUnavailableText: 사유·종료일을 한 줄로, 열려 있으면 null', () => {
  assert.equal(facilityUnavailableText({}), null)
  assert.equal(isFacilityUnavailable({ unavailable: {} }), true)
  assert.equal(facilityUnavailableText({ unavailable: {} }), '지금 이용할 수 없어요')
  assert.equal(facilityUnavailableText({ unavailable: { reason: '공사', until: '2026-12-01T23:59' } }), '지금 이용할 수 없어요 · 공사 · 12월 1일까지')
  assert.equal(facilityUnavailableText({ unavailable: { until: '2026-12-01T18:00' } }), '지금 이용할 수 없어요 · 12월 1일 18:00까지')
})

test('facilityMarkers: 한 건물에 묶인 시설이 모두 닫혔을 때만 핀이 이용 불가', () => {
  const buildings = [{ name: 'R동', lat: 37.55, lng: 126.92 }] as Building[]
  const open: Facility = { id: 'a', kind: '프린터', buildingName: 'R동', floor: 1 }
  const closed: Facility = { id: 'b', kind: '프린터', buildingName: 'R동', floor: 2, unavailable: { reason: '고장' } }
  assert.equal(facilityMarkers([closed], buildings, '프린터')[0].unavailable, true)
  assert.equal(facilityMarkers([open, closed], buildings, '프린터')[0].unavailable, false)
  assert.equal(facilityMarkers([closed, open], buildings, '프린터')[0].unavailable, false)
})

const GRAPH: AdminWalkGraph = {
  vertices: [
    { id: 'n1', lat: 37.55, lng: 126.92, type: 0 },
    { id: 'n2', lat: 37.551, lng: 126.921, type: 0 },
    { id: 'n3@hongik_r:1', lat: 37.551, lng: 126.921, type: 1, building: 'hongik_r', floor: 1, label: 'HI_R_1F_ENTER' },
    { id: 'n3@hongik_r:2', lat: 37.551, lng: 126.921, type: 0, building: 'hongik_r', floor: 2 },
  ],
  edges: [
    { a: 'n2', b: 'n1', kind: 'normal' },
    { a: 'n2', b: 'n3@hongik_r:1', kind: 'normal' },
    { a: 'n3@hongik_r:1', b: 'n3@hongik_r:2', kind: 'stairs_vertical' },
  ],
  buildings: [{ code: 'hongik_r', name: '홍문관 R동', lat: 37.551, lng: 126.921 }],
}

test('buildRoadMap: 실외 길만 그리고 층 이동 간선은 뺀다, 열쇠는 작은 쪽 먼저', () => {
  const map = buildRoadMap(GRAPH, 400)
  assert.deepEqual(map.edges.map((e) => e.key), ['n1|n2', 'n2|n3@hongik_r:1'])
  assert.equal(edgeKey('n2', 'n1'), 'n1|n2')
  assert.deepEqual(map.entrances.map((e) => e.name), ['홍문관 R동 1층 출입구'])
  // 북쪽이 위: 위도가 큰 n2 가 n1 보다 위(y 가 작다).
  const [first] = map.edges
  assert.ok(first.b.y < first.a.y || first.a.y < first.b.y)
  assert.equal(filterEntrances(map.entrances, '홍문관').length, 1)
  assert.equal(filterEntrances(map.entrances, '없는건물').length, 0)
})

test('buildRoadInput: 대상 필수, 기간(시작·끝) 검증', () => {
  const now = new Date(2026, 10, 22, 10, 0)
  assert.deepEqual(buildRoadInput(emptyRoadDraft('EDGE'), now).errors, ['지도에서 막을 길 구간을 눌러 고르세요.'])
  const closure = { ...emptyRoadDraft('EDGE'), target: 'n1|n2', reason: ' 공사 ', startsAt: '2026-12-01 09:00', endsAt: '2026-12-01 18:00' }
  assert.deepEqual(buildRoadInput(closure, now).input,
    { purpose: 'CLOSURE', cause: 'CONSTRUCTION', kind: 'EDGE', target: 'n1|n2', reason: '공사', startsAt: '2026-12-01T09:00', endsAt: '2026-12-01T18:00' })
  // 상시 규칙은 이유·기간을 보내지 않는다(입력칸에 남은 지난 날짜도 무시).
  const rule = { ...emptyRoadDraft('BUILDING_PASS', 'RULE'), target: 'hongik_z1', endsAt: '2026-11-01' }
  assert.deepEqual(buildRoadInput(rule, now).input,
    { purpose: 'RULE', cause: undefined, kind: 'BUILDING_PASS', target: 'hongik_z1', reason: undefined, startsAt: undefined, endsAt: undefined })
  assert.deepEqual(buildRoadInput({ ...emptyRoadDraft('ENTRANCE'), target: 'HI_R_1F_ENTER', endsAt: '2026-11-01' }, now).errors,
    ['끝이 이미 지났어요. 앞으로의 시각을 고르거나 비워 주세요.'])
})

test('term: 날짜만 쓰면 시작 0시·끝 23:59, 목록 글자와 단계', () => {
  assert.equal(parseTermInput('2026-12-01', 'start'), '2026-12-01T00:00')
  assert.equal(parseTermInput('2026-12-01', 'end'), '2026-12-01T23:59')
  assert.equal(parseTermInput('2026-02-30', 'end'), 'invalid')
  assert.equal(parseTermInput('2026-12-01 25:00', 'end'), 'invalid')
  assert.equal(parseTermInput('  ', 'start'), null)
  assert.equal(termToInput('2026-12-01T23:59', 'end'), '2026-12-01')
  assert.equal(termToInput('2026-12-01T09:30', 'start'), '2026-12-01 09:30')
  assert.equal(termLabel('2026-12-01T09:00', '2026-12-01T18:00'), '12-01 09:00 ~ 12-01 18:00')
  assert.equal(termLabel(null, null), '지금 ~ 풀 때까지')
  const now = new Date(2026, 10, 22, 10, 0)
  assert.equal(termPhase('2026-12-01T00:00', null, now), 'upcoming')
  assert.equal(termPhase(null, '2026-11-21T23:59', now), 'ended')
  assert.equal(termPhase('2026-11-22T09:00', '2026-11-22T18:00', now), 'active')
})

test('pickAt: 출입구가 가까우면 출입구, 아니면 가까운 길 구간, 멀면 없음', () => {
  const map = buildRoadMap(GRAPH, 400)
  const entrance = map.entrances[0]
  assert.deepEqual(pickAt(map, entrance.at.x + 2, entrance.at.y), { kind: 'ENTRANCE', label: 'HI_R_1F_ENTER' })
  const edge = map.edges.find((e) => e.key === 'n1|n2')!
  const mid = { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 }
  assert.deepEqual(pickAt(map, mid.x + 3, mid.y), { kind: 'EDGE', key: 'n1|n2' })
  assert.equal(pickAt(map, -500, -500), null)
})
