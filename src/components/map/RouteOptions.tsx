import { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { RADIUS } from "../../constants/spacing";
import { FONTS } from "../../constants/typography";
import { ROUTE_DIRECTIONS_TEXT_ENABLED } from "../../constants/route";
import { describeRoutes } from "../../utils/routeLabels";
import type { RouteAlternative } from "../../apis/routes";

interface RouteOptionsProps {
  routes: readonly RouteAlternative[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** 카드 오른쪽 위 X — 길찾기 끝내기(11-09: 오른손 엄지로 누르기 쉬운 자리). */
  onClose?: () => void;
}

/** 카드 사이 틈(한쪽). 넘기는 동안 카드끼리 붙어 보이지 않게. */
const PAGE_GAP = 4;
/** 넘기기를 멈춘 뒤 이만큼 지나면 그 카드로 정한다(웹은 관성 끝 이벤트가 없어 스크롤 멈춤으로 판단한다). */
const SETTLE_MS = 140;

/**
 * 길찾기 결과 카드(11-09 사용자 요청: 후보 3개 정도, 옆으로 넘겨 보기). 카드 하나가 후보 하나다 —
 * 이름(가장 빠른 길·T동 거쳐 …), 더 걸리는 시간, 도보 시간·거리, 계단·엘리베이터, 어림 안내.
 * 길 흐름·조사 메모 글은 ROUTE_DIRECTIONS_TEXT_ENABLED 가 켜졌을 때만 보인다(11-11 끔).
 * 옆으로 넘기면 그 길을 고른 것으로 보고(`onSelect`) 지도에서 그 길이 굵어진다. 아래 점이 몇 번째인지 보여 준다.
 */
export default function RouteOptions({
  routes,
  selectedIndex,
  onSelect,
  onClose,
}: RouteOptionsProps) {
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const texts = describeRoutes(routes);
  const page = width + PAGE_GAP * 2;

  // 밖에서 고른 길이 바뀌면(새 경로는 0번부터) 그 카드로 옮긴다.
  useEffect(() => {
    if (page > 0)
      scrollRef.current?.scrollTo({ x: selectedIndex * page, animated: true });
  }, [selectedIndex, page]);
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const index = Math.max(
        0,
        Math.min(routes.length - 1, Math.round(x / page)),
      );
      if (index !== selectedIndex) onSelect(index);
    }, SETTLE_MS);
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={handleScroll}
          scrollEnabled={routes.length > 1}
          style={{ width: page, marginHorizontal: -PAGE_GAP }}
          contentContainerStyle={styles.track}
        >
          {routes.map((route, index) => {
            const text = texts[index];
            const note = route.isEstimate
              ? "캠퍼스 길에서 멀어 직선 거리로 어림했어요"
              : route.hasLinkSegment
                ? "건물 앞 일부 구간은 가까운 길까지 직선으로 이었어요"
                : null;
            return (
              <View
                key={index}
                style={{ width: page, paddingHorizontal: PAGE_GAP }}
              >
                <View style={styles.card}>
                  <View
                    style={[styles.content, onClose && styles.contentWithClose]}
                    accessible
                    accessibilityLabel={[
                      routes.length > 1
                        ? `경로 ${index + 1}/${routes.length}`
                        : null,
                      text?.label,
                      text?.delta,
                      `${route.minutes}분, ${route.distanceMeters}m`,
                      ...(text?.tags ?? []),
                      ROUTE_DIRECTIONS_TEXT_ENABLED && route.steps?.length
                        ? route.steps.join(", ")
                        : null,
                      ...(ROUTE_DIRECTIONS_TEXT_ENABLED ? (route.notes ?? []) : []),
                      note,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    accessibilityHint={
                      routes.length > 1
                        ? "옆으로 넘기면 다른 길을 볼 수 있어요"
                        : undefined
                    }
                  >
                    {routes.length > 1 ? (
                      <View style={styles.titleLine}>
                        <Text style={styles.label} numberOfLines={1}>
                          {text?.label}
                        </Text>
                        {text?.delta ? (
                          <Text style={styles.delta}>{text.delta}</Text>
                        ) : null}
                      </View>
                    ) : null}
                    <View style={styles.mainLine}>
                      <Text style={styles.time}>{route.minutes}분</Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {[
                          `${route.distanceMeters}m`,
                          route.isEstimate ? "직선 어림" : null,
                          ...(text?.tags ?? []),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    {/* 길 설명 글은 ROUTE_DIRECTIONS_TEXT_ENABLED 로 감춘다(11-11 — 아직 정확하지 않음). */}
                    {ROUTE_DIRECTIONS_TEXT_ENABLED && route.steps?.length ? (
                      <Text style={styles.steps} numberOfLines={2}>
                        {route.steps.join("  →  ")}
                      </Text>
                    ) : null}
                    {ROUTE_DIRECTIONS_TEXT_ENABLED && route.notes?.length ? (
                      <Text style={styles.notes} numberOfLines={2}>
                        {route.notes.slice(0, 3).join(" · ")}
                        {route.notes.length > 3
                          ? ` 외 ${route.notes.length - 3}곳`
                          : ""}
                      </Text>
                    ) : null}
                    {note ? <Text style={styles.note}>{note}</Text> : null}
                  </View>
                  {routes.length > 1 ? (
                    // 몇 번째 길인지: 카드 안 아래 가운데(11-09 — 지도 위에 두니 잘 안 보였다).
                    <View
                      style={styles.dots}
                      importantForAccessibility="no-hide-descendants"
                    >
                      {routes.map((_, dot) => (
                        <View
                          key={dot}
                          style={[styles.dot, dot === index && styles.dotOn]}
                        />
                      ))}
                    </View>
                  ) : null}
                  {onClose ? (
                    <TouchableOpacity
                      style={styles.close}
                      onPress={onClose}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="길찾기 끝내기"
                    >
                      <Ionicons name="close" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 그림자가 잘리지 않게 위아래로 조금 띄운다(ScrollView 는 넘친 그림자를 자른다).
  // 카드 높이가 달라도 아래쪽에 붙게(지도 아래 기준선에 맞춤).
  track: { paddingTop: 2, paddingBottom: 10, alignItems: "flex-end" },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  titleLine: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  label: {
    flexShrink: 1,
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.primary,
  },
  delta: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  mainLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  time: { fontSize: 20, color: COLORS.primary, fontFamily: FONTS.bold },
  meta: {
    flexShrink: 1,
    fontSize: 13.5,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  /** 길 흐름: 'R동 1층 출구 → T동 3층 출입구 → 엘리베이터로 5층'. */
  steps: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textPrimary,
    fontFamily: FONTS.semibold,
  },
  /** 지나는 곳 조사 메모. */
  notes: {
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },
  note: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },
  content: { gap: 6 },
  /** 오른쪽 위 X 자리만큼 비운다. */
  contentWithClose: { paddingRight: 40 },
  close: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.chipBorder,
  },
  dotOn: { width: 16, backgroundColor: COLORS.primary },
});
