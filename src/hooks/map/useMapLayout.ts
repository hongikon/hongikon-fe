import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Animated, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useNavigation } from '@react-navigation/native'
import { MAP_TAB_BAR_HIDDEN_STYLE, MAP_TAB_BAR_STYLE } from '../../navigation/tabBarStyles'
import { useCenteredGutter } from '../useCenteredGutter'
import type { Building, Partner, ReportListItem } from '../../types'

/**
 * 위 검색바·칩 막대의 높이와 가림 상태.
 * 검색바·필터 칩이 지도 위에 뜨는 오버레이라, 실제 렌더된 높이만큼 지도 위 배너·상단바들을 밀어내야 겹치지 않는다.
 * 칩 줄 수가 상태(피킹 모드·레이어 선택)에 따라 달라 고정값을 못 쓴다.
 * 길찾기가 이 높이를 먼저 읽으므로 useMapLayout 보다 앞서 부른다.
 */
export function useMapHeader() {
  const [headerHeight, setHeaderHeight] = useState(0)
  // 시트를 화면 맨 위까지 올리면 검색바·칩을 잠깐 숨긴다(시트 위에 겹쳐 그려지지 않게). useSheetSizing 이 알려 준다.
  const [headerCovered, setHeaderCovered] = useState(false)
  const headerFade = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.timing(headerFade, { toValue: headerCovered ? 0 : 1, duration: 160, useNativeDriver: false }).start()
  }, [headerCovered, headerFade])
  const sheetHeaderCtx = useMemo(() => ({ headerHeight, onCoverHeader: setHeaderCovered }), [headerHeight])
  return { headerHeight, setHeaderHeight, headerCovered, headerFade, sheetHeaderCtx }
}

const styles = StyleSheet.create({
  mapControls: { position: 'absolute', right: 12, bottom: 20, gap: 8 },
})

interface LayoutOptions {
  /** 아래 탭바(또는 안전 영역) 높이를 담는 ref. 경로를 화면에 맞출 때 길찾기가 읽으므로 호출하는 쪽이 먼저 만들어 넘긴다. */
  bottomInsetRef: RefObject<number>
  selectedBuilding: Building | null
  selectedPartner: Partner | null
  selectedReport: ReportListItem | null
  selectedFacilityBuilding: string | null
  facilityKind: string | null
  pickingLocation: boolean
  fromBuilding: Building | null
  fromMyLocation: boolean
  toBuilding: Building | null
  headerHeight: number
  /** 아래 길찾기 결과 카드 높이. */
  routeCardHeight: number
}

/**
 * 지도 화면의 배치 값: 시트가 열렸는지·길찾기 중인지에 따른 탭바 숨김, 아래쪽 기준선, 시트 바닥, 지도 메뉴 위치.
 * 탭바 스타일은 이 훅이 navigation 에 직접 건다.
 */
export function useMapLayout(options: LayoutOptions) {
  const {
    bottomInsetRef,
    selectedBuilding,
    selectedPartner,
    selectedReport,
    selectedFacilityBuilding,
    facilityKind,
    pickingLocation,
    fromBuilding,
    fromMyLocation,
    toBuilding,
    headerHeight,
    routeCardHeight,
  } = options
  const navigation = useNavigation()
  // react-native-safe-area-context 는 iOS Modal 안에서 top inset 을 0으로 보고하는
  // 알려진 문제가 있어서 (https://github.com/th3rdwave/react-native-safe-area-context/issues/677),
  // Modal 바깥의 화면에서 미리 재서 넘긴다.
  const insets = useSafeAreaInsets()
  // 지도 탭만 탭바를 지도 위에 띄운다(TabNavigator.tsx) — 그만큼 화면 맨
  // 아래에 깔린 버튼·배너가 탭바에 가리지 않게 이 높이만큼 띄워 올린다.
  const tabBarHeight = useBottomTabBarHeight()
  const { height: windowHeight } = useWindowDimensions()
  // 넓은 창(폴드 펼침·가로·웹)에서 지도는 끝까지 깔되, 검색바·칩·배너·하단 시트는
  // 가운데 한 폭(SHEET_MAX_WIDTH)에 모은다. 좁은 화면에선 0 이라 기존 배치 그대로다.
  // 폴드를 접고 펴면 앱이 다시 시작되지 않고 창 크기만 바뀌므로 매 렌더 다시 계산한다.
  const sideGutter = useCenteredGutter()

  /**
   * 건물·제휴·편의시설·제보 시트를 여는 동안에는 아래 탭 막대를 잠시 숨겨 시트를 화면 맨 아래까지 내린다.
   * 시트를 읽는 중엔 탭을 옮길 일이 거의 없고, 탭바가 시트 아래를 받쳐 지도를 더 가렸다. 닫으면 다시 보인다.
   */
  const sheetOpen =
    selectedBuilding !== null ||
    selectedPartner !== null ||
    selectedReport !== null ||
    (selectedFacilityBuilding !== null && facilityKind !== null)
  /**
   * 길찾기 중(출발·도착 막대가 떠 있는 동안, 11-09 사용자 요청): 다른 탭으로 갈 일이 없고 제휴 검색·칩도 쓸 일이 없어
   * 아래 탭 막대와 위 검색바·칩을 숨긴다. 그 자리를 출발·도착 막대(오른쪽 위 X 로 끝내기)와 아래 경로 카드가 쓴다.
   */
  const routeMode = !pickingLocation && (fromBuilding !== null || fromMyLocation || toBuilding !== null)
  const tabBarHidden = sheetOpen || routeMode
  // 화면을 그리기 전에(useLayoutEffect) 탭바를 바꾼다. useEffect 면 시트와 탭바가 한 프레임 겹쳐 보여 반짝였다.
  useLayoutEffect(() => {
    navigation.setOptions({ tabBarStyle: tabBarHidden ? MAP_TAB_BAR_HIDDEN_STYLE : MAP_TAB_BAR_STYLE })
  }, [navigation, tabBarHidden])
  /** 지도 위 아래쪽 버튼·카드의 기준선. 탭바가 숨으면 홈 인디케이터 여백만. */
  const bottomInset = tabBarHidden ? insets.bottom : tabBarHeight
  bottomInsetRef.current = bottomInset
  // 탭바를 숨긴 동안 시트는 화면 맨 아래에 붙는다(지도 아래쪽 NAVER 로고 줄까지 덮는다).
  // 홈 인디케이터 여백은 각 시트가 안쪽 아래 여백(useSafeAreaInsets)으로 띄운다.
  const sheetBottom = sheetOpen ? 0 : tabBarHeight

  /** 아래 길찾기 결과 카드가 떠 있으면 그 위로 올린다. */
  const mapMenuBottom =
    20 + bottomInset + (!pickingLocation && !sheetOpen && (fromBuilding || fromMyLocation) && toBuilding ? routeCardHeight + 8 : 0)
  const mapMenuStyle = useMemo(() => [styles.mapControls, { bottom: mapMenuBottom }], [mapMenuBottom])
  /** 검색바·칩(headerHeight) 아래부터 접기 버튼(46 + 간격 10) 위까지. */
  const mapMenuMaxItemsHeight = Math.max(160, windowHeight - (20 + tabBarHeight) - 56 - headerHeight - 12)

  return { insets, sideGutter, sheetOpen, routeMode, bottomInset, sheetBottom, mapMenuStyle, mapMenuMaxItemsHeight }
}
