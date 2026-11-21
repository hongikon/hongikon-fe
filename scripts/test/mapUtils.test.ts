import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routePinBuilding } from '../../src/utils/map/routePinBuilding'
import { buildingLabel, offscreenSummary } from '../../src/utils/map/labels'
import { searchPinnedSection } from '../../src/utils/map/searchPinned'
import { partnerEditSuggestion } from '../../src/utils/map/partnerEdit'
import { overlayMarkerMessages } from '../../src/utils/map/mapSync'
import { mapVisibility } from '../../src/utils/map/visibility'
import { withRo } from '../../src/utils/common/josa'

const b = (id: number | undefined, name: string, lat: number, lng: number) => ({ id, name, lat, lng }) as never

test('핀 아래 건물 이름이 있으면 그 건물', () => {
  const list = [b(1, 'A', 37.55, 126.92), b(2, 'B', 37.5501, 126.9201)]
  assert.equal((routePinBuilding({ lat: 37.55, lng: 126.92, buildingName: 'B' }, list) as { name: string }).name, 'B')
})

test('이름이 없으면 150m 안 가장 가까운 건물, 없으면 null, id 없는 건물은 빼고', () => {
  const list = [b(undefined, '가까운데 id 없음', 37.55, 126.92), b(2, '50m', 37.55045, 126.92), b(3, '100m', 37.5509, 126.92)]
  assert.equal((routePinBuilding({ lat: 37.55, lng: 126.92, buildingName: null }, list) as { name: string }).name, '50m')
  assert.equal(routePinBuilding({ lat: 37.56, lng: 126.92, buildingName: null }, list), null)
})

test('건물 이름에 층, 업체 줄임', () => {
  assert.equal(buildingLabel(b(1, '홍문관 R동', 0, 0), null), '홍문관 R동')
  assert.equal(buildingLabel(b(1, '홍문관 R동', 0, 0), 3), '홍문관 R동 3F')
  assert.equal(offscreenSummary([{ name: 'a' }, { name: 'b' }, { name: 'c' }] as never), 'a, b 외 1곳')
  assert.equal(offscreenSummary([{ name: 'a' }] as never), 'a')
})

test('검색 창 맨 위 묶음: 근처 알림이 먼저, 그다음 안 보이는 곳, 둘 다 없으면 없음', () => {
  const a = [{ id: 'a' }] as never
  const two = [{ id: 'x' }, { id: 'y' }] as never
  assert.equal(searchPinnedSection(a, two)?.title, '지금 계신 곳 근처 제휴')
  assert.equal(searchPinnedSection(null, two)?.title, '지도에 안 보이는 2곳')
  assert.equal(searchPinnedSection([], two)?.partners.length, 2)
  assert.equal(searchPinnedSection(null, []), undefined)
  assert.equal(searchPinnedSection(null, null), undefined)
})

test('제휴 정보 수정 채우기: 위치·이름·주소(없으면 빈 칸)·첫 소속', () => {
  const full = partnerEditSuggestion({ lat: 1, lng: 2, name: '가게', address: '서울', affiliations: ['총학생회', '컴공'] } as never)
  assert.deepEqual(full.location, { lat: 1, lng: 2, buildingName: null })
  assert.deepEqual(full.prefill, { type: 'partner', kind: 'fix', name: '가게', address: '서울', affiliation: '총학생회' })
  const bare = partnerEditSuggestion({ lat: 1, lng: 2, name: '가게' } as never)
  assert.equal(bare.prefill.address, '')
  assert.equal(bare.prefill.affiliation, null)
})

test('칩 마커 메시지: 필터·시설 종류가 없으면 보낼 것이 없다', () => {
  const r = overlayMarkerMessages({
    partners: [], buildings: [], facilities: [], exhibitions: [],
    activeFilter: { affiliation: null, category: null }, facilityKind: null,
  })
  assert.deepEqual(r, { filteredPartners: null, partnersMessage: null, facilitiesMessage: null })
})

test('칩 마커 메시지: 필터가 걸리면 맞는 업체만 setPartners(bounds 없음)', () => {
  const p = (id: string, affiliations: string[]) => ({ id, name: id, lat: 37.55, lng: 126.92, affiliations, category: '카페' }) as never
  const r = overlayMarkerMessages({
    partners: [p('a', ['총학생회']), p('b', ['컴공'])], buildings: [], facilities: [], exhibitions: [],
    activeFilter: { affiliation: '총학생회', category: null } as never, facilityKind: null,
  })
  assert.deepEqual(r.filteredPartners?.map((x) => x.id), ['a'])
  const msg = r.partnersMessage as { type: string; partners: { id: string }[]; bounds: null }
  assert.equal(msg.type, 'setPartners')
  assert.deepEqual(msg.partners.map((x) => x.id), ['a'])
  assert.equal(msg.bounds, null)
  assert.equal(r.facilitiesMessage, null)
})

test('칩 마커 메시지: 시설 종류가 있으면 setFacilities', () => {
  const r = overlayMarkerMessages({
    partners: [], buildings: [], facilities: [], exhibitions: [],
    activeFilter: { affiliation: null, category: null }, facilityKind: '프린터' as never,
  })
  assert.equal((r.facilitiesMessage as { type: string }).type, 'setFacilities')
  assert.equal(r.partnersMessage, null)
})

test('화면 요소 보임: 위치를 고르는 동안은 안내·메뉴·길찾기 카드가 모두 숨는다', () => {
  const base = {
    pickingLocation: false, routeMode: false, sheetOpen: false, routeHasFrom: false, hasTo: false,
    nearbyPicking: false, nearbyOverlayOn: false, reportsOn: false, reportsLoading: false, reportsErrored: false,
    hotOnly: false, reportsMatchHot: false, reportsEmpty: false, reportsLoaded: false, reportSheetOpen: false,
  }
  const idle = mapVisibility(base)
  assert.equal(idle.showSearchAndChips, true)
  assert.equal(idle.showMapMenu, true)
  assert.equal(idle.showRouteStrip, false)
  const picking = mapVisibility({ ...base, pickingLocation: true, routeHasFrom: true, hasTo: true })
  assert.deepEqual(
    [picking.showSearchAndChips, picking.showRouteStrip, picking.showRouteResultCard, picking.showMapMenu, picking.showOverlayNotices],
    [false, false, false, false, false],
  )
})

test('길찾기 카드는 두 끝을 정하고 시트가 닫혔을 때만, 길찾기 중엔 검색바가 숨는다', () => {
  const base = {
    pickingLocation: false, routeMode: true, sheetOpen: false, routeHasFrom: true, hasTo: false,
    nearbyPicking: false, nearbyOverlayOn: false, reportsOn: false, reportsLoading: false, reportsErrored: false,
    hotOnly: false, reportsMatchHot: false, reportsEmpty: false, reportsLoaded: false, reportSheetOpen: false,
  }
  assert.equal(mapVisibility(base).showSearchAndChips, false)
  assert.equal(mapVisibility(base).showRouteStrip, true)
  assert.equal(mapVisibility(base).showRouteResultCard, false)
  assert.equal(mapVisibility({ ...base, hasTo: true }).showRouteResultCard, true)
  assert.equal(mapVisibility({ ...base, hasTo: true, sheetOpen: true }).showRouteResultCard, false)
  assert.equal(mapVisibility({ ...base, sheetOpen: true }).showMapMenu, false)
})

test('제보 안내: 불러오는 중·오류·HOT 목록 조건', () => {
  const base = {
    pickingLocation: false, routeMode: false, sheetOpen: false, routeHasFrom: false, hasTo: false,
    nearbyPicking: false, nearbyOverlayOn: false, reportsOn: true, reportsLoading: true, reportsErrored: false,
    hotOnly: true, reportsMatchHot: true, reportsEmpty: false, reportsLoaded: true, reportSheetOpen: false,
  }
  const v = mapVisibility(base)
  assert.equal(v.showReportsLoadingNotice, true)
  assert.equal(v.showHotReportList, true)
  assert.equal(mapVisibility({ ...base, reportsErrored: true }).showReportsLoadingNotice, false)
  assert.equal(mapVisibility({ ...base, reportsErrored: true }).showReportsError, true)
  assert.equal(mapVisibility({ ...base, reportSheetOpen: true }).showHotReportList, false)
  assert.equal(mapVisibility({ ...base, reportsOn: false }).showReportsError, false)
  assert.equal(mapVisibility({ ...base, nearbyOverlayOn: true }).showNearbyOverlayNote, true)
  assert.equal(mapVisibility({ ...base, nearbyOverlayOn: true, nearbyPicking: true }).showNearbyOverlayNote, false)
})

test('방향 조사: 받침 있으면 으로, 없거나 ㄹ 받침이면 로', () => {
  assert.equal(withRo('홍문관 R동'), '홍문관 R동으로')
  assert.equal(withRo('체육관'), '체육관으로')
  assert.equal(withRo('운동장'), '운동장으로')
  assert.equal(withRo('제2기숙사'), '제2기숙사로')
  assert.equal(withRo('과학관 I동'), '과학관 I동으로')
  assert.equal(withRo('서울'), '서울로')
  assert.equal(withRo('제4공학관 T동'), '제4공학관 T동으로')
  assert.equal(withRo('강당 S동'), '강당 S동으로')
  assert.equal(withRo('정문'), '정문으로')
  assert.equal(withRo('Z2'), 'Z2로')
  assert.equal(withRo('센터 R'), '센터 R로')
  assert.equal(withRo('A3'), 'A3으로')
  assert.equal(withRo('학생회관(G)'), '학생회관(G)로')
})
