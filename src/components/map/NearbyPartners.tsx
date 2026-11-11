import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, AppState } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { partnerCategoryMeta } from "../../constants/partnerCategories";
import { formatDistance, partnersNear, type PartnerDistance } from "../../lib/nearbyPartners/rules";
import {
  CAN_OPEN_LOCATION_SETTINGS,
  CAN_TURN_ON_LOCATION_SERVICES,
  canLocate,
  getLocationPermission,
  locateOnce,
  openLocationSettings,
  turnOnLocationServices,
  type LocateResult,
} from "../../lib/nearbyPartners/platform";
import Button from "../common/Button";
import type { Partner } from "../../types";

/** 걸어서 6~7분. 이보다 먼 곳은 "근처"라고 보기 어렵다. */
const NEARBY_RADIUS_METERS = 500;
const NEARBY_LIMIT = 10;
/** 위치 오차가 이보다 크면(실내·Wi-Fi 끔·대략적 위치) 거리가 틀릴 수 있다고 알린다. */
const INACCURATE_METERS = 150;

export type NearbyState = { kind: "idle" } | { kind: "locating" } | { kind: "done"; result: LocateResult };

export const INITIAL_NEARBY_STATE: NearbyState = { kind: "idle" };

interface NearbyPartnersProps {
  partners: readonly Partner[];
  onSelect: (partner: Partner) => void;
  /**
   * 상태는 검색 창(PartnerSearchModal)이 들고 있다 — 검색어를 쳤다 지우면 이 블록이 다시 그려지는데, 그때 위치를 또 읽지 않게.
   * 검색 창을 닫으면 창이 처음 상태로 되돌린다(읽은 좌표를 남기지 않는다).
   */
  state: NearbyState;
  onStateChange: (next: NearbyState) => void;
}

/**
 * 검색 창 맨 위 "내 주변 제휴". 누를 때만 위치를 한 번 읽어 500m 안 업체를 가까운 순으로 보여 준다.
 * 좌표는 화면 상태에만 두고 저장하거나 서버로 보내지 않는다(검색 창을 닫으면 사라진다).
 * 위치를 읽을 수 없는 기기(이 기능 전 바이너리, HTTPS 아닌 웹)에서는 아무것도 그리지 않는다.
 */
export default function NearbyPartners({ partners, onSelect, state, onStateChange }: NearbyPartnersProps) {
  const available = useMemo(() => canLocate(), []);

  const located = state.kind === "done" && state.result.status === "ok" ? state.result : null;
  const nearby = useMemo(
    () => (located ? partnersNear(partners, located.lat, located.lng, NEARBY_RADIUS_METERS, NEARBY_LIMIT) : []),
    [partners, located],
  );
  // 500m 안에 없으면 가장 가까운 한 곳이라도 보여 준다(캠퍼스에서 먼 곳에서 "없어요"로 끝나지 않게).
  const closest = useMemo(
    () => (located && nearby.length === 0 ? partnersNear(partners, located.lat, located.lng, Infinity, 1)[0] ?? null : null),
    [partners, located, nearby.length],
  );

  const locate = async () => {
    onStateChange({ kind: "locating" });
    const result = await locateOnce("nearby");
    // 위치 정보 사용 안내에서 '동의하지 않음' — 처음 상태로(버튼을 다시 누를 수 있게).
    onStateChange(result.status === "declined" ? { kind: "idle" } : { kind: "done", result });
  };

  // 휴대폰 설정에서 권한·위치를 켜고 돌아오면 다시 누르지 않아도 바로 찾는다.
  const waitingForSettings =
    state.kind === "done" && (state.result.status === "denied" || state.result.status === "servicesOff");
  useEffect(() => {
    if (!waitingForSettings) return;
    const sub = AppState.addEventListener("change", async (next) => {
      if (next !== "active") return;
      const permission = await getLocationPermission();
      if (permission?.status === "granted") void locate();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForSettings]);

  if (!available) return null;

  const turnOn = async () => {
    if (await turnOnLocationServices()) void locate();
  };

  const renderStatus = () => {
    if (state.kind === "idle") {
      return (
        <>
          <Text style={styles.hint}>누를 때 위치를 한 번 확인해요. 위치는 저장하거나 서버로 보내지 않아요.</Text>
          <Button label="내 주변 제휴 보기" icon="navigate-outline" variant="secondary" size="md" onPress={locate} />
        </>
      );
    }
    if (state.kind === "locating") {
      return (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.hint}>위치를 확인하는 중이에요</Text>
        </View>
      );
    }
    const { result } = state;
    switch (result.status) {
      case "denied":
        if (!CAN_OPEN_LOCATION_SETTINGS) {
          return (
            <Text style={styles.hint}>브라우저에서 위치를 막아 두었어요. 주소창의 사이트 설정에서 위치를 허용한 뒤 다시 열어 주세요.</Text>
          );
        }
        return result.canAskAgain ? (
          <>
            <Text style={styles.hint}>위치를 허용하지 않아 주변 제휴를 찾지 못했어요. 다시 누르면 한 번 더 물어봐요.</Text>
            <Button label="다시 시도" variant="outline" size="sm" fullWidth={false} onPress={locate} />
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              위치 권한이 꺼져 있어요. 휴대폰 설정에서 위치를 '앱을 사용하는 동안'으로 바꾸면 바로 찾아 드려요.
            </Text>
            <Button label="설정 열기" variant="outline" size="sm" fullWidth={false} onPress={openLocationSettings} />
          </>
        );
      case "servicesOff":
        return (
          <>
            <Text style={styles.hint}>휴대폰의 위치 서비스가 꺼져 있어요.</Text>
            {CAN_TURN_ON_LOCATION_SERVICES ? (
              <Button label="위치 켜기" variant="outline" size="sm" fullWidth={false} onPress={turnOn} />
            ) : (
              <Button label="다시 시도" variant="outline" size="sm" fullWidth={false} onPress={locate} />
            )}
          </>
        );
      case "failed":
        return (
          <>
            <Text style={styles.hint}>위치를 확인하지 못했어요. 실내라면 창가나 밖에서 다시 시도해 주세요.</Text>
            <Button label="다시 시도" variant="outline" size="sm" fullWidth={false} onPress={locate} />
          </>
        );
      case "ok":
      case "declined":
        return null;
    }
  };

  const renderRow = ({ partner, meters }: PartnerDistance) => {
    const meta = partnerCategoryMeta(partner.category);
    return (
      <TouchableOpacity
        key={partner.id}
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => onSelect(partner)}
        accessibilityRole="button"
        accessibilityLabel={`${partner.name}, ${formatDistance(meters)}`}
      >
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {partner.name}
          </Text>
          {partner.benefit && (
            <Text style={styles.benefit} numberOfLines={1}>
              {partner.benefit}
            </Text>
          )}
        </View>
        <Text style={styles.distance}>{formatDistance(meters)}</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.chevron} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Ionicons name="navigate-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.headerText}>내 주변 제휴</Text>
          {located && <Text style={styles.count}>{nearby.length}곳</Text>}
        </View>
        {located && (
          <TouchableOpacity onPress={locate} hitSlop={10} accessibilityRole="button" accessibilityLabel="내 위치 다시 확인">
            <Ionicons name="refresh" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {renderStatus()}

      {located && (
        <>
          {located.accuracy !== null && located.accuracy > INACCURATE_METERS && (
            <Text style={styles.hint}>위치가 정확하지 않아 실제 거리와 다를 수 있어요.</Text>
          )}
          {nearby.length > 0 ? (
            nearby.map(renderRow)
          ) : (
            <>
              <Text style={styles.hint}>
                {formatDistance(NEARBY_RADIUS_METERS)} 안에는 제휴 업체가 없어요.{closest ? " 가장 가까운 곳은 여기예요." : ""}
              </Text>
              {closest && renderRow(closest)}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 4,
    paddingBottom: 12,
    gap: 8,
    alignItems: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 18,
  },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerText: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.primary },
  count: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  benefit: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  distance: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
});
