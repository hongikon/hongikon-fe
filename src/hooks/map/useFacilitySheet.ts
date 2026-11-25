import { useEffect, useRef, useState } from 'react'
import { ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FACILITY_KINDS } from '../../constants/facilityKinds'
import type { Facility } from '../../types'
import { useSheetSizing } from './useResizableSheet'
import { useCafeteriaWeek } from './useCafeteriaWeek'
import { ADMIN_OFFICE_DETAILS } from '../../constants/adminOffices'
import type { FacilitySheetProps } from '../../components/map/FacilitySheet'

/** FacilitySheet 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useFacilitySheet({ kind, items, onClose, officeDetails = ADMIN_OFFICE_DETAILS, highlightId = null }: Pick<FacilitySheetProps, 'kind' | 'items' | 'onClose' | 'officeDetails' | 'highlightId'>) {
  // 시트는 화면 맨 아래에 붙으므로 홈 인디케이터 높이만큼 안쪽 아래 여백을 더 준다.
  const insets = useSafeAreaInsets();
  const meta = FACILITY_KINDS.find((k) => k.key === kind);
  const color = meta?.color ?? COLORS.primary;
  const sorted = [...items].sort((a, b) => (b.floor ?? -99) - (a.floor ?? -99));
  // 학과사무실처럼 한 건물에 줄이 많은 경우(C동 13곳) 시트가 화면을 덮지 않게 목록만 스크롤한다.
  const { height: windowHeight } = useWindowDimensions();
  // 식당 시트를 열 때만 학식 메뉴를 부른다(주간 메뉴를 한 번 받아 앱을 켜 둔 동안 메모리에 둔다).
  const isRestaurant = kind === "식당";
  const cafeteriaWeek = useCafeteriaWeek(isRestaurant);
  // 손잡이(회색 줄)로 작게 → 보통 → 화면 위 끝까지 크기 조절(useSheetSizing).
  const { translateY, bodyHeight, panHandlers, chromeHandlers, onChromeLayout, onContentSizeChange, bodyGesture } = useSheetSizing(onClose, {
    smallRatio: 0.22,
    // 검색으로 찾아온 줄은 맨 위로 스크롤해 보여 준다. 작게(화면 22%)로 열면 그 줄과 안내가 반쯤 잘려 보여(10-27) 보통 크기로 연다.
    openAt: highlightId ? "mid" : "small",
  });
  // 찾아온 줄이 목록 아래쪽(홍문관 행정 부서 20여 곳 등)이면 처음 한 번 그 줄이 맨 위에 오게 스크롤한다.
  // 줄마다 위치를 기억해 두어, 시트가 열린 채 같은 건물의 다른 시설을 다시 검색해 와도 바로 스크롤한다.
  const scrollRef = useRef<ScrollView | null>(null);
  const rowY = useRef(new Map<string, number>());
  const [layoutTick, setLayoutTick] = useState(0);
  const scrolledFor = useRef<string | null>(null);
  // 행정·지원 줄의 '>'를 누르면 그 부서만의 안내(주요업무 전문·연락처 전체)를 시트 안에서 연다. '<'로 목록에 돌아온다.
  const [openOffice, setOpenOffice] = useState<Facility | null>(null);
  const officeDetail = openOffice ? officeDetails[openOffice.id] : undefined;
  const showOffice = (item: Facility | null) => {
    setOpenOffice(item);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  useEffect(() => {
    if (!highlightId || scrolledFor.current === highlightId) return;
    const y = rowY.current.get(highlightId);
    if (y === undefined) return;
    scrolledFor.current = highlightId;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: false });
  }, [highlightId, layoutTick]);
  return {
    insets,
    meta,
    color,
    sorted,
    isRestaurant,
    cafeteriaWeek,
    translateY,
    bodyHeight,
    panHandlers,
    chromeHandlers,
    onChromeLayout,
    onContentSizeChange,
    bodyGesture,
    scrollRef,
    rowY,
    setLayoutTick,
    openOffice,
    officeDetail,
    showOffice,
  }
}
