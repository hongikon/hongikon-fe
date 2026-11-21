import { memo } from 'react'
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SheetHandle from "../SheetHandle";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { partnerCategoryMeta } from "../../../constants/partnerCategories";
import type { Partner } from "../../../types";
import { FONTS, TYPE } from "../../../constants/typography";
import IconButton from "../../common/IconButton";
import { sheetCloseStyle } from "../chipStyles";
import { useSheetSizing } from "../../../hooks/useResizableSheet";
import { openExternalUrl } from "../../../utils/common/openExternalUrl";
import { openNaverMapPlace } from "../../../utils/openNaverMap";
import { RADIUS } from "../../../constants/spacing";
import SheetScrollBody from "../SheetScrollBody";
import NearbyAlertPromo from "../nearby/NearbyAlertPromo";
import PartnerBenefitCard from "./PartnerBenefitCard";
import { hasAlcoholBenefit } from "../../../utils/map/partnerBenefits";

interface PartnerSheetProps {
  partner: Partner;
  onClose: () => void;
  /** 시트 맨 아래 "정보 수정 요청" — 그 가게로 정보 제보(수정) 창을 연다. 없으면 줄을 그리지 않는다. */
  onSuggestEdit?: () => void;
}

/**
 * 제휴 업체 상세. 혜택이 가장 중요하므로 카드로 강조한다.
 * benefit / address / hours / contact / link 는 값이 있을 때만 렌더한다.
 */
function PartnerSheet({ partner, onClose, onSuggestEdit }: PartnerSheetProps) {
  // 손잡이(회색 줄)로 머리줄만 → 작게 → 보통 → 화면 위 끝까지 크기 조절(useSheetSizing).
  const { translateY, bodyHeight, panHandlers, chromeHandlers, onChromeLayout, onContentSizeChange, bodyGesture } = useSheetSizing(onClose, {
    smallRatio: 0.22,
  });
  // 시트는 화면 맨 아래에 붙으므로 홈 인디케이터 높이만큼 안쪽 아래 여백을 더 준다.
  const insets = useSafeAreaInsets();
  const meta = partnerCategoryMeta(partner.category);
  return (
    <Animated.View style={[styles.sheet, { paddingBottom: 30 + insets.bottom, transform: [{ translateY }] }]}>
      <View onLayout={onChromeLayout} {...chromeHandlers}>
      <SheetHandle panHandlers={panHandlers} />

      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: meta.color }]}>
          <Text style={styles.badgeText}>{partner.category}</Text>
        </View>
        <IconButton
          icon="close"
          size={20}
          color={COLORS.textTertiary}
          onPress={onClose}
          accessibilityLabel="닫기"
          style={sheetCloseStyle}
        />
      </View>

      <Text style={styles.name}>{partner.name}</Text>

      </View>

      <SheetScrollBody
        sheetGesture={bodyGesture} onContentSizeChange={onContentSizeChange}
       
        style={[styles.body, { height: bodyHeight }]}
        contentContainerStyle={styles.bodyContent}
      >
        {partner.benefit && <PartnerBenefitCard partner={partner} benefit={partner.benefit} color={meta.color} />}

        {hasAlcoholBenefit(partner) && (
          <View style={styles.ageNotice}>
            <Ionicons name="alert-circle-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.ageNoticeText}>만 19세 미만은 주류를 살 수 없어요</Text>
          </View>
        )}

        {partner.address && (
          <View style={styles.row}>
            <Ionicons
              name="location-outline"
              size={13}
              color={COLORS.primary}
            />
            <Text style={styles.rowText}>{partner.address}</Text>
          </View>
        )}

        {partner.hours && (
          <View style={styles.row}>
            <Ionicons name="time-outline" size={13} color={COLORS.primary} />
            <Text style={styles.rowText}>{partner.hours}</Text>
          </View>
        )}

        {partner.contact && (
          <View style={styles.row}>
            <Ionicons name="call-outline" size={13} color={COLORS.primary} />
            <Text style={styles.rowText}>{partner.contact}</Text>
          </View>
        )}

        {/* 영업시간·메뉴·리뷰는 네이버 지도 장소 화면에서 본다(크롤링하지 않고 그 화면으로 보내기만 한다). */}
        <TouchableOpacity
          style={styles.naverBtn}
          onPress={() => openNaverMapPlace(partner)}
          accessibilityRole="link"
          accessibilityLabel={`${partner.name} 네이버 지도에서 영업시간과 메뉴 보기`}
        >
          <View style={styles.naverBadge}>
            <Text style={styles.naverBadgeText}>N</Text>
          </View>
          <Text style={styles.naverText}>네이버 지도에서 영업시간·메뉴 보기</Text>
          <Ionicons name="open-outline" size={14} color={COLORS.textTertiary} />
        </TouchableOpacity>

        {partner.link && (
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => openExternalUrl(partner.link!.url)}
          >
            <Ionicons name="open-outline" size={14} color={COLORS.primary} />
            <Text style={styles.linkText}>{partner.link.label}</Text>
          </TouchableOpacity>
        )}

        <NearbyAlertPromo />
        {/* 혜택·시간이 바뀌었거나 틀렸으면 바로 운영진에게(11-01). 정보 제보 창이 '정보 수정'으로 열린다. */}
        {onSuggestEdit && (
          <TouchableOpacity
            style={styles.suggestEdit}
            onPress={onSuggestEdit}
            accessibilityRole="button"
            accessibilityLabel={`${partner.name} 정보 수정 요청`}
          >
            <Ionicons name="create-outline" size={15} color={COLORS.textSecondary} />
            <Text style={styles.suggestEditText}>정보 수정 요청</Text>
          </TouchableOpacity>
        )}
      </SheetScrollBody>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 시트 맨 아래 작은 글자 줄(주 행동이 아니라 눈에 덜 띄게).
  suggestEdit: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 4, marginTop: 16, paddingVertical: 6, paddingHorizontal: 10 },
  suggestEditText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary, textDecorationLine: "underline" },
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
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  badgeText: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.white },
  name: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  body: { marginTop: 12 },
  bodyContent: { paddingBottom: 4 },
  ageNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -4,
    marginBottom: 8,
  },
  ageNoticeText: { ...TYPE.caption, color: COLORS.textSecondary },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingVertical: 5,
  },
  rowText: { fontFamily: FONTS.regular, flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.textSecondary },
  naverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.fill,
  },
  // 네이버 지도 쪽으로 넘어간다는 걸 알아보게 하는 작은 'N' 표시(네이버 로고 이미지는 쓰지 않는다).
  naverBadge: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "#03C75A",
    alignItems: "center",
    justifyContent: "center",
  },
  naverBadgeText: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: 12, lineHeight: 14 },
  naverText: { flex: 1, fontSize: 13.5, color: COLORS.textPrimary, fontFamily: FONTS.semibold },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 13,
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
    textDecorationLine: "underline",
  },
});
export default memo(PartnerSheet)
