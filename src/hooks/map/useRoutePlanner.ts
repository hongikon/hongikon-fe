import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { RouteAlternative } from '../../apis/routes'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import type { RouteEndpoint } from '../../components/map/route/RouteEndpointInputs'
import type { LivePosition } from '../../lib/nearbyPartners/platform'
import type { Building, Facility, FacilityKind } from '../../types'
import { buildFloorOptions, hasFloorData } from '../../utils/common/floors'
import { buildingLabel } from '../../utils/map/labels'
import { pendingStartScript, ROUTE_HITS_CLEAR_SCRIPT, routeStyleScript } from '../../utils/routeStyleScript'
import { useRouteData } from './useRouteData'

/** 경로 메시지를 보낸 뒤 남색으로 다시 칠하고 화면을 맞추기까지 기다리는 시간. */
const ROUTE_STYLE_DELAY_MS = 300

/** 출발·도착 층 다이얼 팝업(11-03). initialFloor: 다이얼을 열 때 먼저 골라 둘 층(필터 칩 시설이 여러 층이면 가장 아래 층, 11-16). */
export interface FloorDial {
  role: '출발' | '도착'
  building: Building
  initialFloor?: number | null
}

interface Options {
  webViewRef: RefObject<NaverMapViewHandle | null>
  postToMap: (msg: object) => void
  buildings: readonly Building[]
  /** 지도 위 막대(검색바·칩) 높이. 경로를 화면에 맞출 때 그 아래부터 쓴다. */
  headerHeight: number
  /** 아래 탭바(또는 안전 영역) 높이. 경로를 화면에 맞출 때 그 위까지 쓴다. */
  bottomInsetRef: RefObject<number>
  /** 학교 시설 칩. 켠 채 건물을 도착으로 고르면 그 시설이 있는 층을 도착 층으로 쓴다(11-16). */
  facilityKind: FacilityKind | null
  facilities: readonly Facility[]
  /** 출발·도착을 정했을 때(열린 건물·시설 시트를 닫는 등). */
  onCommitEndpoint?: () => void
}

/**
 * 길찾기: 출발·도착(건물·층, 또는 출발 '내 위치'), 층 다이얼, 길찾기 창(검색), 후보 길 받기·고르기·지도에 그리기.
 * '내 위치' 위치 권한 묻기와 지도 점은 화면(useLiveLocation)이 맡고, 여기는 출발을 내 위치로 바꾸는 것(startFromMyLocation)만 한다.
 */
export function useRoutePlanner({
  webViewRef,
  postToMap,
  buildings,
  headerHeight,
  bottomInsetRef,
  facilityKind,
  facilities,
  onCommitEndpoint,
}: Options) {
  const onCommitRef = useRef(onCommitEndpoint)
  onCommitRef.current = onCommitEndpoint

  const [fromBuilding, setFromBuilding] = useState<Building | null>(null)
  const [toBuilding, setToBuilding] = useState<Building | null>(null)
  const [fromFloor, setFromFloor] = useState<number | null>(null)
  const [toFloor, setToFloor] = useState<number | null>(null)
  const [floorDial, setFloorDial] = useState<FloorDial | null>(null)
  /**
   * 출발지 '내 위치'(11-03). 위치는 길찾기를 보는 동안만 휴대폰에서 읽어 경로 계산과 지도 점에만 쓰고,
   * 저장하거나 서버로 보내지 않는다(처리방침 11-09판 "길찾기 화면을 보는 동안에만").
   */
  const [fromMyLocation, setFromMyLocation] = useState(false)
  /** 경로를 다시 계산하는 기준 위치. 15m 넘게 움직였을 때만 바뀐다(useLiveLocation). */
  const [routeOrigin, setRouteOrigin] = useState<LivePosition | null>(null)
  /** 길찾기 창(건물 검색). */
  const [showSearch, setShowSearch] = useState(false)
  const [searchTarget, setSearchTarget] = useState<RouteEndpoint | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cardHeight, setCardHeight] = useState(0)

  /** 길찾기 표시의 첫 층 이동을 '1F→3F' 로 쓰려고 그리는 함수에서 읽는다. */
  const fromFloorRef = useRef(fromFloor)
  fromFloorRef.current = fromFloor
  const hasFromRef = useRef(false)
  hasFromRef.current = fromBuilding !== null || fromMyLocation
  /**
   * 경로를 화면에 맞출 때 쓰는 실측 높이(11-08). 전에는 막대 100px·카드 90px 어림값이라 기기·글자 크기에 따라 경로가 카드나
   * 막대에 가렸다. 맞추는 스크립트를 넣는 순간 값을 읽도록 ref 에 둔다(높이가 바뀔 때마다 경로를 다시 그리지 않게).
   */
  const stripHeightRef = useRef(0)
  const cardHeightRef = useRef(cardHeight)
  cardHeightRef.current = cardHeight

  const hasFrom = fromBuilding !== null || fromMyLocation
  /**
   * 한쪽 끝만 정한 채 나머지를 고르는 중. 이때 칩을 눌러도 건물 시트를 닫지 않는다(11-08 — 도착을 고르러 연 건물 시트가
   * 칩 때문에 사라져 처음부터 다시 찾아야 했다).
   */
  const picking = hasFrom !== (toBuilding !== null)
  /** 두 끝이 다 정해져 경로가 지도에 그려진 상태. 칩 핀을 흐리게 해 경로가 묻히지 않게 한다. */
  const drawn = hasFrom && toBuilding !== null
  const drawnRef = useRef(drawn)
  drawnRef.current = drawn

  // 출발 건물만 고른 동안 그 건물에 '출발' 표시(11-16). 도착까지 고르면 지도 페이지가 경로와 함께 제 표시를 올리므로 지운다.
  const pendingStart = fromBuilding && !toBuilding ? fromBuilding : null
  useEffect(() => {
    webViewRef.current?.injectJavaScript(pendingStartScript(pendingStart ? { lat: pendingStart.lat, lng: pendingStart.lng } : null))
  }, [pendingStart, webViewRef])

  // 후보 길(서버 계산, 내 위치 출발은 길 묶음을 받아 휴대폰에서 고른다).
  const alternatives = useRouteData({ fromBuilding, fromFloor, toBuilding, toFloor, fromMyLocation, routeOrigin, buildings })
  const alternativesRef = useRef(alternatives)
  alternativesRef.current = alternatives
  /** 지금 고른 경로(내 위치 점을 경로선에 붙일 때 쓴다). */
  const selectedRouteRef = useRef<RouteAlternative | null>(null)
  selectedRouteRef.current = alternatives[selectedIndex] ?? null

  /** 경로를 지도에 그리고, 위 막대·아래 카드에 가리지 않게 화면을 맞춘다. */
  const draw = useCallback(
    (routes: RouteAlternative[], index: number) => {
      postToMap({ type: 'showRoute', routes: routes.map((route) => ({ points: route.points })), selectedIndex: index })
      const fitScript = () =>
        routeStyleScript(
          index,
          {
            top: headerHeight + 8 + (stripHeightRef.current || 100) + 24,
            bottom: (bottomInsetRef.current ?? 0) + 12 + (cardHeightRef.current || 90) + 24,
          },
          routes,
          routes[index]?.markers ?? [],
          fromFloorRef.current,
        )
      for (const delay of [ROUTE_STYLE_DELAY_MS, ROUTE_STYLE_DELAY_MS * 4]) {
        setTimeout(() => webViewRef.current?.injectJavaScript(fitScript()), delay)
      }
    },
    [postToMap, headerHeight, bottomInsetRef, webViewRef],
  )

  // 출발·도착이 바뀌어 후보가 새로 오면(둘 다 골랐을 때만 채워진다) 첫 번째 후보로 다시 그린다.
  useEffect(() => {
    setSelectedIndex(0)
    if (alternatives.length > 0) draw(alternatives, 0)
  }, [alternatives, draw])

  /** 후보 목록에서 다른 길을 고르면, 다시 그리지 않고 스타일만 바꾼다. */
  const selectAlternative = useCallback(
    (index: number) => {
      setSelectedIndex(index)
      postToMap({ type: 'selectRouteAlternative', index })
      setTimeout(
        () =>
          webViewRef.current?.injectJavaScript(
            routeStyleScript(index, undefined, alternativesRef.current, alternativesRef.current[index]?.markers ?? [], fromFloorRef.current),
          ),
        ROUTE_STYLE_DELAY_MS,
      )
    },
    [postToMap, webViewRef],
  )

  // ---- 길찾기 창 ----
  /** 길찾기 버튼: 정하지 않은 쪽(출발 먼저)을 검색 창으로 고른다. */
  const openSearch = useCallback(() => {
    setSearchQuery('')
    setSearchTarget(hasFromRef.current ? 'to' : 'from')
    setShowSearch(true)
  }, [])
  /** 길찾기 창을 닫는다. 출발·도착을 고르면 지도로 돌아가 경로 막대·결과 카드로 이어 간다(11-03). */
  const closeSearch = useCallback(() => {
    setShowSearch(false)
    setSearchTarget(null)
    setSearchQuery('')
  }, [])
  const changeSearchTarget = useCallback((target: RouteEndpoint) => {
    setSearchTarget(target)
    setSearchQuery('')
  }, [])

  // ---- 출발·도착 정하기 ----
  const commitFrom = useCallback(
    (building: Building, floor: number | null) => {
      setFromMyLocation(false)
      setFromBuilding(building)
      setFromFloor(floor)
      onCommitRef.current?.()
      closeSearch()
    },
    [closeSearch],
  )
  const commitTo = useCallback(
    (building: Building, floor: number | null) => {
      setToBuilding(building)
      setToFloor(floor)
      onCommitRef.current?.()
      closeSearch()
    },
    [closeSearch],
  )

  /**
   * 출발 정하기. 층을 고를 수 있는 건물이면 다이얼 팝업으로 층부터 묻고, 아니면 바로 정한다.
   * `floor` 를 주면(제보 시트 — 제보가 적힌 층) 다이얼 없이 그 층으로 바로 정한다. 부르는 쪽이 건물 층 목록에 있는 층만 넘긴다.
   */
  const beginFrom = useCallback(
    (building: Building, floor?: number | null) => {
      if (typeof floor === 'number') commitFrom(building, floor)
      else if (hasFloorData(building)) setFloorDial({ role: '출발', building })
      else commitFrom(building, null)
    },
    [commitFrom],
  )

  /**
   * 도착 정하기. 학교 시설 필터 칩(열람실 등)을 켠 채 건물을 도착으로 고르면 그 시설이 있는 층을 도착 층으로 쓴다(11-16 사용자 요청).
   * 한 층에만 있으면 바로 정하고, 여러 층이면 층 다이얼을 가장 아래 층에 맞춰 연다.
   */
  const beginTo = useCallback(
    (building: Building, floor?: number | null) => {
      // 제보 시트에서 제보가 적힌 층을 넘기면 다이얼 없이 그 층으로 정한다(11-20 사용자).
      if (typeof floor === 'number') {
        commitTo(building, floor)
        return
      }
      const options = buildFloorOptions(building).map((o) => o.value)
      if (options.length === 0) {
        commitTo(building, null)
        return
      }
      const kindFloors = facilityKind
        ? [
            ...new Set(
              facilities
                .filter((f) => f.kind === facilityKind && f.buildingName === building.name && typeof f.floor === 'number')
                .map((f) => f.floor as number),
            ),
          ]
            .filter((floor) => options.includes(floor))
            .sort((a, b) => a - b)
        : []
      if (kindFloors.length === 1) commitTo(building, kindFloors[0])
      else setFloorDial({ role: '도착', building, initialFloor: kindFloors[0] ?? null })
    },
    [commitTo, facilityKind, facilities],
  )

  const confirmFloorDial = useCallback(
    (floor: number) => {
      const dial = floorDial
      setFloorDial(null)
      if (!dial) return
      if (dial.role === '출발') commitFrom(dial.building, floor)
      else commitTo(dial.building, floor)
    },
    [floorDial, commitFrom, commitTo],
  )
  const cancelFloorDial = useCallback(() => setFloorDial(null), [])
  /** 다이얼을 열 때 먼저 골라 둘 층: 정해 준 층, 아니면 그 건물로 이미 정한 층. */
  const floorDialInitial =
    floorDial?.initialFloor != null
      ? floorDial.initialFloor
      : floorDial?.role === '출발'
      ? fromBuilding === floorDial.building
        ? fromFloor
        : null
      : floorDial && toBuilding === floorDial.building
      ? toFloor
      : null

  /** 길찾기 창 목록에서 건물을 고르면 지금 고르는 쪽으로. */
  const selectSearchBuilding = useCallback(
    (building: Building) => {
      if (searchTarget === 'from') beginFrom(building)
      else if (searchTarget === 'to') beginTo(building)
    },
    [searchTarget, beginFrom, beginTo],
  )

  /** 출발·도착 막대의 줄: 건물이면 그 건물 층 바꾸기, 아니면 길찾기 창에서 그쪽을 고른다. */
  const pressEndpoint = useCallback(
    (endpoint: RouteEndpoint) => {
      const building = endpoint === 'from' ? fromBuilding : toBuilding
      if (building) {
        if (endpoint === 'from') beginFrom(building)
        else beginTo(building)
        return
      }
      setSearchTarget(endpoint)
      setSearchQuery('')
      setShowSearch(true)
    },
    [fromBuilding, toBuilding, beginFrom, beginTo],
  )

  /** 출발을 '내 위치'로(위치를 한 번 잰 뒤). */
  const startFromMyLocation = useCallback(() => {
    setFromMyLocation(true)
    setFromBuilding(null)
    setFromFloor(null)
    closeSearch()
  }, [closeSearch])

  /** 출발·도착 바꾸기. 내 위치는 도착이 될 수 없어 그때는 바꾸지 않는다. */
  const swap = useCallback(() => {
    if (fromMyLocation || !fromBuilding || !toBuilding) return
    setFromBuilding(toBuilding)
    setFromFloor(toFloor)
    setToBuilding(fromBuilding)
    setToFloor(fromFloor)
  }, [fromMyLocation, fromBuilding, toBuilding, fromFloor, toFloor])

  /** 길찾기 끝내기: 출발·도착을 비우고 지도에서 경로를 지운다. */
  const clear = useCallback(() => {
    setFromMyLocation(false)
    setFromBuilding(null)
    setToBuilding(null)
    setFromFloor(null)
    setToFloor(null)
    postToMap({ type: 'clearRoute' })
    webViewRef.current?.injectJavaScript(ROUTE_HITS_CLEAR_SCRIPT)
  }, [postToMap, webViewRef])

  const onStripHeight = useCallback((height: number) => {
    stripHeightRef.current = height
  }, [])

  /** 지도에서 경로를 누른 시각. 같은 손동작으로 뒤따르는 지도 탭을 거르는 데 쓴다. */
  const routeTapAtRef = useRef(0)

  /** 지도에서 회색(다른) 경로를 눌렀다(11-09) — 범위 안의 번호면 그 길로 바꾸고, 누른 시각을 적어 둔다. */
  const handleRouteTap = useCallback(
    (index: number) => {
      routeTapAtRef.current = Date.now()
      if (index >= 0 && index < alternativesRef.current.length) selectAlternative(index)
    },
    [selectAlternative],
  )

  /**
   * 이 지도 탭 메시지를 무시해야 하는지. 경로를 누른 바로 그 손동작의 지도 탭은 무시한다. 경로를 보여 주는 동안에는 지도 탭 자체로
   * 건물을 고르지 않는다(11-12) — 길(선)을 누른 탭이 경로 선이 아닌 건물 위로 들어와 건물 배너가 경로 카드를 가렸다.
   * 위치 고르기 중에는 경로를 보여 주는 중이 아니다(pickingLocation).
   */
  const ignoresMapTap = useCallback(
    (type: string, pickingLocation: boolean): boolean =>
      ((type === 'buildingTap' || type === 'buildingDismiss') && Date.now() - routeTapAtRef.current < 500) ||
      (type === 'buildingTap' && !pickingLocation && drawnRef.current),
    [],
  )

  return {
    fromBuilding,
    toBuilding,
    fromFloor,
    toFloor,
    fromMyLocation,
    hasFrom,
    picking,
    drawn,
    drawnRef,
    routeOrigin,
    setRouteOrigin,
    alternatives,
    alternativesRef,
    selectedIndex,
    selectedRouteRef,
    selectAlternative,
    handleRouteTap,
    ignoresMapTap,
    floorDial,
    floorDialInitial,
    confirmFloorDial,
    cancelFloorDial,
    showSearch,
    searchTarget,
    searchQuery,
    setSearchQuery,
    openSearch,
    closeSearch,
    changeSearchTarget,
    selectSearchBuilding,
    pressEndpoint,
    beginFrom,
    beginTo,
    /** 층을 묻지 않고 바로 정한다(물어보기 '여기서 가는 길'처럼 층을 이미 아는 경우). */
    commitFrom,
    commitTo,
    startFromMyLocation,
    swap,
    clear,
    cardHeight,
    setCardHeight,
    onStripHeight,
    fromLabel: fromBuilding ? buildingLabel(fromBuilding, fromFloor) : fromMyLocation ? '내 위치' : null,
    toLabel: toBuilding ? buildingLabel(toBuilding, toFloor) : null,
  }
}
