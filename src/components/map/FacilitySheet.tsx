import { memo } from 'react'
import SheetHandle from "./SheetHandle";
import { KindIcon } from "./ChipIcon";
import { Animated, View, Text, StyleSheet } from 'react-native'
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { facilityChipLabel } from '../../constants/facilityKinds'
import type { Exhibition, Facility, FacilityKind } from "../../types";
import { splitFacilityNote } from "../../utils/map/facilityNote";
import { OfficeFull, OfficePreview } from "./facility/OfficeDetails";
import { VenueExhibitions } from "./facility/VenueExhibitions";
import { NoteText } from "./facility/FacilityNoteText";
import IconButton from "../common/IconButton";
import { sheetCloseStyle } from "./chipStyles";
import { formatFloor } from "../../utils/common/floors";
import CafeteriaMenu from "./facility/CafeteriaMenu";
import { RADIUS } from "../../constants/spacing";
import { ADMIN_OFFICE_DETAILS, type AdminOfficeDetail } from "../../constants/adminOffices";
import SheetScrollBody, { SheetTouchable } from "./SheetScrollBody";
import RouteEndpointButtons from './route/RouteEndpointButtons'
import { type RouteNext } from '../../utils/map/route/routeEndpointButtons'
import { useFacilitySheet } from '../../hooks/map/useFacilitySheet'

export interface FacilitySheetProps {
  kind: FacilityKind;
  buildingName: string;
  /** 이 건물에 있는 같은 종류의 시설(층마다 한 줄). */
  items: readonly Facility[];
  /** 지도 데이터의 전시 전체. '행사·전시' 시트에서만 쓴다(시설 id 로 골라 각 줄 아래에 보여 준다). */
  exhibitions?: readonly Exhibition[];
  onClose: () => void;
  /** 건물 시트에서 넘어왔으면 그 건물 시트로 돌아가기. 머리에 '<'를 단다. */
  onBack?: () => void;
  backLabel?: string;
  /** 행정·지원 부서 안내 표. 기본은 홍익대(`ADMIN_OFFICE_DETAILS`). `/dev/sogang` 미리보기는 서강대 표를 넘긴다. */
  officeDetails?: Record<string, AdminOfficeDetail>;
  /** 검색으로 찾아온 시설 id. 그 줄을 메인 색 테두리로 표시하고 보이게 스크롤한다(10-12 요청). */
  highlightId?: string | null;
  /**
   * 이 시설이 있는 건물을 길찾기 출발·도착으로 정하는 버튼(11-08). 셋 다 있을 때만 그린다 — 지도 데이터에 그 건물이 없거나
   * 길찾기가 꺼져 있으면 넘기지 않는다.
   */
  onSetFrom?: () => void;
  onSetTo?: () => void;
  routeNext?: RouteNext;
}

/**
 * 편의시설 핀을 눌렀을 때의 배너. 건물 소개가 아니라 "그 시설이 몇 층 어디에 있는지"를 보여 준다.
 * 같은 건물에 여러 층이 있으면 층마다 한 줄. 층이 확인되지 않은 항목은 "층 확인 중"으로 둔다.
 * '행사·전시'면 줄마다 그 전시장의 지금 전시·다음 전시를 붙인다.
 * '식당'이면 학식 메뉴가 있는 줄(제2기숙사 학생식당·교직원식당) 아래에 주간 메뉴를 붙인다.
 */
function FacilitySheet({ kind, buildingName, items, exhibitions, onClose, onBack, backLabel, officeDetails = ADMIN_OFFICE_DETAILS, highlightId = null, onSetFrom, onSetTo, routeNext = null }: FacilitySheetProps) {
  const { insets, meta, color, sorted, isRestaurant, cafeteriaWeek, translateY, bodyHeight, panHandlers, chromeHandlers, onChromeLayout, onContentSizeChange, bodyGesture, scrollRef, rowY, setLayoutTick, openOffice, officeDetail, showOffice } = useFacilitySheet({ kind, items, onClose, officeDetails, highlightId })

  return (
    <Animated.View style={[styles.sheet, { paddingBottom: 30 + insets.bottom, transform: [{ translateY }] }]}>
      <View onLayout={onChromeLayout} {...chromeHandlers}>
      <SheetHandle panHandlers={panHandlers} />

      <View style={styles.header}>
        {openOffice && officeDetail ? (
          <View style={styles.titleRow}>
            <IconButton icon="chevron-back" size={22} color={COLORS.textPrimary} onPress={() => showOffice(null)} accessibilityLabel={`${facilityChipLabel(kind)} 목록으로`} />
            <View style={styles.titleText}>
              <Text style={styles.name} numberOfLines={1}>{splitFacilityNote(openOffice.note ?? kind).title}</Text>
              <Text style={styles.building}>
                {openOffice.floor !== undefined ? `${buildingName} ${formatFloor(openOffice.floor)}` : buildingName}
              </Text>
            </View>
          </View>
        ) : (
        <View style={styles.titleRow}>
          {onBack ? (
            <IconButton icon="chevron-back" size={22} color={COLORS.textPrimary} onPress={onBack} accessibilityLabel={backLabel ?? "건물 정보로 돌아가기"} />
          ) : null}
          <View style={[styles.icon, { backgroundColor: color }]}>
            <KindIcon name={meta?.icon ?? "location"} size={15} color={COLORS.white} />
          </View>
          <View>
            <Text style={styles.name}>{facilityChipLabel(kind)}</Text>
            <Text style={styles.building}>{buildingName}</Text>
          </View>
        </View>
        )}
        <IconButton
          icon="close"
          size={20}
          color={COLORS.textTertiary}
          onPress={onClose}
          accessibilityLabel="닫기"
          style={sheetCloseStyle}
        />
      </View>

      {/* 부서 안내를 펼친 동안에는 숨긴다. 출발·도착은 이 시설이 있는 건물로 정한다. */}
      {onSetFrom && onSetTo && !(openOffice && officeDetail) && (
        <RouteEndpointButtons name={buildingName} routeNext={routeNext} onSetFrom={onSetFrom} onSetTo={onSetTo} />
      )}
      </View>

      <SheetScrollBody
        sheetGesture={bodyGesture} onContentSizeChange={onContentSizeChange}
        scrollRef={scrollRef}
       
        // 메뉴가 붙으면 끼니 4개·반찬 여러 줄로 길어진다. 스크롤이 맨 위·맨 아래에 닿은 채 더 끌면 시트 크기가 바뀐다(sheetGesture).
        style={{ height: bodyHeight }}
        contentContainerStyle={styles.list}
        bounces={false}
      >
        {openOffice && officeDetail ? (
          <OfficeFull note={openOffice.note} detail={officeDetail} />
        ) : sorted.map((item) => {
          const highlighted = item.id === highlightId;
          const onLayout = (e: { nativeEvent: { layout: { y: number } } }) => {
            rowY.current.set(item.id, e.nativeEvent.layout.y);
            if (highlighted) setLayoutTick((n) => n + 1);
          };
          const row = (
            <View
              style={[styles.row, highlighted && styles.rowHighlighted]}
              accessible
              accessibilityLabel={`${item.floor !== undefined ? formatFloor(item.floor) : "층 확인 중"} ${item.note ?? kind}`}
            >
              <Text style={[styles.floor, item.floor === undefined && styles.floorUnknown]}>
                {item.floor !== undefined ? formatFloor(item.floor) : "층 확인 중"}
              </Text>
              <NoteText note={item.note ?? kind} />
            </View>
          );
          if (isRestaurant) {
            return (
              <View key={item.id} style={styles.venue} onLayout={onLayout}>
                {row}
                <CafeteriaMenu facilityId={item.id} week={cafeteriaWeek} />
              </View>
            );
          }
          const office = kind === "학생처" ? officeDetails[item.id] : undefined;
          if (office) {
            return (
              <SheetTouchable
                key={item.id}
                style={styles.venue}
                onLayout={onLayout}
                onPress={() => showOffice(item)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${splitFacilityNote(item.note ?? kind).title} 담당 업무와 연락처 보기`}
              >
                {row}
                <OfficePreview detail={office} />
              </SheetTouchable>
            );
          }
          if (kind !== "행사·전시") return <View key={item.id} onLayout={onLayout}>{row}</View>;
          return (
            <View key={item.id} style={styles.venue} onLayout={onLayout}>
              {row}
              <VenueExhibitions facilityId={item.id} exhibitions={exhibitions ?? []} />
            </View>
          );
        })}
      </SheetScrollBody>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  building: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 1 },
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    // 찾아온 줄 테두리가 생겨도 줄 높이가 바뀌지 않게 평소에도 투명 테두리를 둔다.
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  rowHighlighted: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  floor: {
    minWidth: 40,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  floorUnknown: { fontSize: 12, color: COLORS.textTertiary },
  venue: { borderRadius: RADIUS.md, backgroundColor: COLORS.background, overflow: "hidden" },
  titleText: { flexShrink: 1 },
});

export default memo(FacilitySheet)
