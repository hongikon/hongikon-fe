import { useEffect, useRef, useState, type ReactNode } from "react";
import SheetHandle from "./SheetHandle";
import { KindIcon } from "./ChipIcon";
import { Animated, View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { facilityKindLabel } from '../../constants/facilityKinds'
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { FACILITY_KINDS } from "../../constants/facilityKinds";
import type { Exhibition, Facility, FacilityKind } from "../../types";
import IconButton from "../common/IconButton";
import { sheetCloseStyle } from "./chipStyles";
import { useSheetSizing } from "../../hooks/useResizableSheet";
import { formatFloor } from "../../utils/floors";
import {
  daysUntilStart,
  dDayLabel,
  exhibitionsForVenue,
  formatExhibitionPeriod,
  kstTodayIndex,
} from "../../utils/exhibitions";
import { isSafeExternalUrl, openExternalUrl } from "../../utils/openExternalUrl";
import { CAFETERIA_FACILITY_IDS } from "../../apis/cafeteria";
import { useCafeteriaWeek } from "../../hooks/useCafeteriaWeek";
import CafeteriaMenu from "./CafeteriaMenu";
import { RADIUS } from "../../constants/spacing";
import { ADMIN_OFFICE_DETAILS, type AdminOfficeDetail } from "../../constants/adminOffices";
import SheetScrollBody from "./SheetScrollBody";

interface FacilitySheetProps {
  kind: FacilityKind;
  buildingName: string;
  /** 이 건물에 있는 같은 종류의 시설(층마다 한 줄). */
  items: readonly Facility[];
  /** 지도 데이터의 전시 전체. '행사·전시' 시트에서만 쓴다(시설 id 로 골라 각 줄 아래에 보여 준다). */
  exhibitions?: readonly Exhibition[];
  onClose: () => void;
  /** 검색으로 찾아온 시설 id. 그 줄을 메인 색 테두리로 표시하고 보이게 스크롤한다(10-12 요청). */
  highlightId?: string | null;
}

/**
 * 편의시설 핀을 눌렀을 때의 배너. 건물 소개가 아니라 "그 시설이 몇 층 어디에 있는지"를 보여 준다.
 * 같은 건물에 여러 층이 있으면 층마다 한 줄. 층이 확인되지 않은 항목은 "층 확인 중"으로 둔다.
 * '행사·전시'면 줄마다 그 전시장의 지금 전시·다음 전시를 붙인다.
 * '식당'이면 학식 메뉴가 있는 줄(제2기숙사 학생식당·교직원식당) 아래에 주간 메뉴를 붙인다.
 */
export default function FacilitySheet({ kind, buildingName, items, exhibitions, onClose, highlightId = null }: FacilitySheetProps) {
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
  const hasMenu =
    isRestaurant &&
    (items.some((item) => CAFETERIA_FACILITY_IDS.has(item.id)) ||
      !!cafeteriaWeek.data?.days.some((d) => d.restaurants.some((r) => items.some((i) => i.id === r.facilityId))));
  // 손잡이(회색 줄)로 작게 → 보통 → 화면 위 끝까지 크기 조절(useSheetSizing).
  const { translateY, bodyHeight, panHandlers, chromeHandlers, onChromeLayout, onContentSizeChange, bodyGesture } = useSheetSizing(onClose, {
    smallRatio: 0.22,
  });
  // 찾아온 줄이 목록 아래쪽(홍문관 행정 부서 20여 곳 등)이면 처음 한 번 그 줄이 맨 위에 오게 스크롤한다.
  // 줄마다 위치를 기억해 두어, 시트가 열린 채 같은 건물의 다른 시설을 다시 검색해 와도 바로 스크롤한다.
  const scrollRef = useRef<ScrollView | null>(null);
  const rowY = useRef(new Map<string, number>());
  const [layoutTick, setLayoutTick] = useState(0);
  const scrolledFor = useRef<string | null>(null);
  // 행정·지원 줄의 '>'를 누르면 그 부서만의 안내(주요업무 전문·연락처 전체)를 시트 안에서 연다. '<'로 목록에 돌아온다.
  const [openOffice, setOpenOffice] = useState<Facility | null>(null);
  const officeDetail = openOffice ? ADMIN_OFFICE_DETAILS[openOffice.id] : undefined;
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

  return (
    <Animated.View style={[styles.sheet, { paddingBottom: 30 + insets.bottom, transform: [{ translateY }] }]}>
      <View onLayout={onChromeLayout} {...chromeHandlers}>
      <SheetHandle panHandlers={panHandlers} />

      <View style={styles.header}>
        {openOffice && officeDetail ? (
          <View style={styles.titleRow}>
            <IconButton icon="chevron-back" size={22} color={COLORS.textPrimary} onPress={() => showOffice(null)} accessibilityLabel={`${facilityKindLabel(kind)} 목록으로`} />
            <View style={styles.titleText}>
              <Text style={styles.name} numberOfLines={1}>{splitFacilityNote(openOffice.note ?? kind).title}</Text>
              <Text style={styles.building}>
                {openOffice.floor !== undefined ? `${buildingName} ${formatFloor(openOffice.floor)}` : buildingName}
              </Text>
            </View>
          </View>
        ) : (
        <View style={styles.titleRow}>
          <View style={[styles.icon, { backgroundColor: color }]}>
            <KindIcon name={meta?.icon ?? "location"} size={15} color={COLORS.white} />
          </View>
          <View>
            <Text style={styles.name}>{facilityKindLabel(kind)}</Text>
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
          const office = kind === "학생처" ? ADMIN_OFFICE_DETAILS[item.id] : undefined;
          if (office) {
            return (
              <TouchableOpacity
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
              </TouchableOpacity>
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

/**
 * 행정·지원 목록 줄 아래의 짧은 미리보기(10-14 요청): 주요업무 두 줄 + "담당 업무·연락처 N개 >". 줄 전체를 누르면 부서 화면(`OfficeFull`).
 */
function OfficePreview({ detail }: { detail: AdminOfficeDetail }) {
  const summary = detail.summary?.trim();
  const count = detail.contacts?.length ?? 0;
  return (
    <View style={styles.office}>
      {summary ? (
        <Text style={styles.officeSummary} numberOfLines={2}>
          {summary}
        </Text>
      ) : null}
      <View style={styles.officeMore}>
        <Text style={styles.moreText}>{count > 0 ? `담당 업무·연락처 ${count}개` : "부서 안내 보기"}</Text>
        <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
      </View>
    </View>
  );
}

/**
 * 부서 하나의 안내 화면(시트 안). 학교 홈페이지 부서 페이지의 '주요업무' 전문, 대표 메일, '담당정보' 업무별 전화 전부.
 * 담당자 이름은 학교가 공개하지 않아 없다. 전화·메일은 누르면 바로 건다(tel:, mailto:).
 */
function OfficeFull({ note, detail }: { note?: string; detail: AdminOfficeDetail }) {
  const { lines } = splitFacilityNote(note ?? "");
  const summary = detail.summary?.trim();
  const contacts = detail.contacts ?? [];
  const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() => {});
  return (
    <View style={styles.officeFull}>
      {lines.length > 0 ? (
        <View style={styles.officeInfo}>
          {lines.map((line, i) => (
            <Text key={i} style={styles.noteLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      {summary ? (
        <View style={styles.officeSection}>
          <Text style={styles.sectionLabel}>주요업무</Text>
          <Text style={styles.description}>{summary}</Text>
        </View>
      ) : null}
      {detail.email ? (
        <View style={styles.officeSection}>
          <Text style={styles.sectionLabel}>대표 메일</Text>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL(`mailto:${detail.email}`).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`대표 메일 ${detail.email} 보내기`}
          >
            <Ionicons name="mail-outline" size={14} color={COLORS.primary} />
            <Text style={styles.contactValue}>{detail.email}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {contacts.length > 0 ? (
        <View style={styles.officeSection}>
          <Text style={styles.sectionLabel}>{`업무별 연락처 ${contacts.length}`}</Text>
          {contacts.map((c, i) => (
            <TouchableOpacity
              key={`${c.phone}:${i}`}
              style={styles.contactRow}
              onPress={() => call(c.phone)}
              accessibilityRole="button"
              accessibilityLabel={`${c.duty} 전화 ${c.phone} 걸기`}
            >
              <Ionicons name="call-outline" size={14} color={COLORS.primary} />
              <Text style={styles.contactValue}>{c.phone}</Text>
              <Text style={styles.contactDuty}>{c.duty}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <Text style={styles.officeNote}>담당자 이름은 학교 홈페이지에 공개되지 않아 업무별 전화만 보여 드려요.</Text>
      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => openExternalUrl(detail.source)}
        accessibilityRole="link"
        accessibilityLabel="학교 홈페이지에서 부서 안내 보기"
      >
        <Ionicons name="open-outline" size={14} color={COLORS.primary} />
        <Text style={styles.linkText}>학교 홈페이지에서 보기</Text>
      </TouchableOpacity>
    </View>
  );
}

/** 설명이 이보다 길거나 줄바꿈이 있으면 두 줄로 줄이고 "자세히 보기"를 단다. */
const DESCRIPTION_FOLD_CHARS = 60;

/** 전시장 한 곳의 "지금 전시"와 "다음 전시"(최대 2개). 아무것도 없으면 한 줄 안내. */
function VenueExhibitions({ facilityId, exhibitions }: { facilityId: string; exhibitions: readonly Exhibition[] }) {
  const now = Date.now();
  const today = kstTodayIndex(now);
  const { current, upcoming } = exhibitionsForVenue(exhibitions, facilityId, now);

  return (
    <View style={styles.exhibitions}>
      {current.length > 0 ? (
        current.map((exhibition) => <CurrentExhibition key={exhibition.id} exhibition={exhibition} />)
      ) : (
        <Text style={styles.emptyText}>지금 진행 중인 전시 정보가 없어요</Text>
      )}
      {upcoming.length > 0 && (
        <View style={styles.upcoming}>
          <Text style={styles.sectionLabel}>다음 전시</Text>
          {upcoming.map((exhibition) => {
            const dday = dDayLabel(daysUntilStart(exhibition, today));
            return (
              <View
                key={exhibition.id}
                style={styles.upcomingRow}
                accessible
                accessibilityLabel={`다음 전시 ${exhibition.title}, ${formatExhibitionPeriod(exhibition)}, ${dday}`}
              >
                <View style={styles.dday}>
                  <Text style={styles.ddayText}>{dday}</Text>
                </View>
                <View style={styles.upcomingBody}>
                  <Text style={styles.upcomingTitle} numberOfLines={1}>
                    {exhibition.title}
                  </Text>
                  <Text style={styles.metaText}>{formatExhibitionPeriod(exhibition)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function CurrentExhibition({ exhibition }: { exhibition: Exhibition }) {
  const [expanded, setExpanded] = useState(false);
  const description = exhibition.description?.trim();
  const foldable = !!description && (description.length > DESCRIPTION_FOLD_CHARS || description.includes("\n"));
  const link = exhibition.link && isSafeExternalUrl(exhibition.link.url) ? exhibition.link : null;

  return (
    <View style={styles.current}>
      <View style={styles.currentHeader}>
        <View style={styles.nowBadge}>
          <Text style={styles.nowBadgeText}>지금 전시</Text>
        </View>
      </View>
      <Text style={styles.currentTitle}>{exhibition.title}</Text>
      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={13} color={COLORS.textTertiary} />
        <Text style={styles.metaText}>{formatExhibitionPeriod(exhibition)}</Text>
      </View>
      {exhibition.hours ? (
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.textTertiary} />
          <Text style={styles.metaText}>{exhibition.hours}</Text>
        </View>
      ) : null}
      {description ? (
        <>
          <Text style={styles.description} numberOfLines={foldable && !expanded ? 2 : undefined}>
            {description}
          </Text>
          {foldable && (
            <TouchableOpacity
              onPress={() => setExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.moreText}>{expanded ? "접기" : "자세히 보기"}</Text>
            </TouchableOpacity>
          )}
        </>
      ) : null}
      {link && (
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => openExternalUrl(link.url)}
          accessibilityRole="link"
          accessibilityLabel={`${exhibition.title} ${link.label || "전시 안내"}`}
        >
          <Ionicons name="open-outline" size={14} color={COLORS.primary} />
          <Text style={styles.linkText}>{link.label || "전시 안내"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * 시설 설명은 "이름 · 운영시간 · 안내 · …" 한 줄로 온다. 한 문단으로 그리면 읽기 어려워(이름·시간·안내가 섞인다)
 * 첫 조각은 이름으로 굵게, 나머지는 한 줄씩 나눠 쓴다. "학기 중 …(…), 방학 중 …" 처럼 쉼표로 이어진 기간도 줄을 나눈다.
 */
export function splitFacilityNote(note: string): { title: string; lines: string[] } {
  const parts = note
    .split(/\s+·\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const [title = note, ...rest] = parts;
  const lines = rest.flatMap((p) => p.split(/(?<=\)),\s+/).map((l) => l.trim()));
  return { title, lines };
}

/**
 * 스터디룸·세미나실 예약은 신한은행 '헤이영 캠퍼스' 앱에서만 된다(웹 예약 주소 없음, 앱 안 공간예약 화면으로 바로 가는 공개 링크도 없다).
 * 그래서 문구의 '헤이영캠퍼스 공간예약' 을 눌러 앱 스토어의 헤이영 캠퍼스 페이지를 연다 — 설치돼 있으면 스토어에서 바로 '열기'.
 */
const HEYYOUNG_IOS = "https://apps.apple.com/kr/app/id1605688685";
const HEYYOUNG_ANDROID = "https://play.google.com/store/apps/details?id=com.shinhan.heyoung";
const HEYYOUNG_RE = /(헤이영 ?캠퍼스(?: 공간예약)?)/;

function heyYoungUrl(): string {
  if (Platform.OS === "android") return HEYYOUNG_ANDROID;
  if (Platform.OS === "web" && typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)) {
    return HEYYOUNG_ANDROID;
  }
  return HEYYOUNG_IOS;
}

function linkHeyYoung(line: string): ReactNode {
  const parts = line.split(HEYYOUNG_RE);
  if (parts.length === 1) return line;
  return parts.map((part, i) =>
    HEYYOUNG_RE.test(part) ? (
      <Text
        key={i}
        style={styles.noteLink}
        accessibilityRole="link"
        accessibilityHint="헤이영 캠퍼스 앱 스토어 페이지를 엽니다"
        onPress={() => void Linking.openURL(heyYoungUrl())}
      >
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

function NoteText({ note }: { note: string }) {
  const { title, lines } = splitFacilityNote(note);
  return (
    <View style={styles.noteBox}>
      <Text style={styles.note}>{title}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={styles.noteLine}>
          {linkHeyYoung(line)}
        </Text>
      ))}
    </View>
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
    borderRadius: 12,
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
  noteBox: { flex: 1, gap: 3 },
  note: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  noteLink: { color: COLORS.primary, fontFamily: FONTS.semibold, textDecorationLine: "underline" },
  noteLine: { fontSize: 13.5, lineHeight: 20, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  venue: { borderRadius: 12, backgroundColor: COLORS.background, overflow: "hidden" },
  office: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  officeSummary: { fontSize: 12.5, lineHeight: 18, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  officeMore: { flexDirection: "row", alignItems: "center", gap: 2 },
  officeFull: { gap: 16, paddingBottom: 8 },
  officeInfo: { gap: 2 },
  officeSection: { gap: 6 },
  officeNote: { fontSize: 11.5, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  titleText: { flexShrink: 1 },
  contactRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingVertical: 2 },
  contactValue: { fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.primary, fontVariant: ["tabular-nums"] },
  contactDuty: { flex: 1, fontSize: 12.5, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 18 },
  exhibitions: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  current: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  currentHeader: { flexDirection: "row", marginBottom: 2 },
  nowBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  nowBadgeText: { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.white },
  currentTitle: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12.5, fontFamily: FONTS.regular, color: COLORS.textSecondary, fontVariant: ["tabular-nums"] },
  description: { marginTop: 4, fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  moreText: { fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.primary, paddingVertical: 2 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 6 },
  linkText: { fontSize: 13, color: COLORS.primary, fontFamily: FONTS.semibold, textDecorationLine: "underline" },
  upcoming: { gap: 6 },
  sectionLabel: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  upcomingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dday: {
    minWidth: 44,
    alignItems: "center",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: COLORS.primarySoft,
  },
  ddayText: { fontSize: 11.5, fontFamily: FONTS.bold, color: COLORS.primary, fontVariant: ["tabular-nums"] },
  upcomingBody: { flex: 1 },
  upcomingTitle: { fontSize: 13.5, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
});
