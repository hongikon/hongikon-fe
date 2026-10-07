import { useSafeAreaInsets } from "react-native-safe-area-context";
import SheetHandle from "./SheetHandle";
import {
  Animated,
  useWindowDimensions,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { partnerCategoryMeta } from "../../constants/partnerCategories";
import { PARTNER_AFFILIATION_USAGE_NOTES } from "../../constants/partnerAffiliations";
import type { Partner } from "../../types";
import { FONTS, TYPE } from "../../constants/typography";
import IconButton from "../common/IconButton";
import { sheetCloseStyle } from "./chipStyles";
import { useSheetSizing } from "../../hooks/useResizableSheet";
import { openExternalUrl } from "../../utils/openExternalUrl";
import { openNaverMapPlace } from "../../utils/openNaverMap";

interface PartnerSheetProps {
  partner: Partner;
  onClose: () => void;
}

/**
 * " / "로 여러 항목이 이어진 혜택·이용방법 문구를 "- 항목" 줄로 쪼갠다. 구분자가
 * 없으면(하나뿐이면) 그대로 한 줄만 돌려준다 — "단품/세트"처럼 공백 없이 붙은
 * "/"는 복합 단어라 여기 안 걸린다(제휴업체 데이터가 이 표기 규칙을 따른다).
 */
function splitBulletItems(text: string): string[] {
  const items = text.split(" / ");
  return items.length > 1 ? items : [text];
}

/**
 * 주류 혜택이 있는 업체인지. 주점 카테고리는 모두, 그 밖의 업체는 혜택 문구에 술 이름이 있을 때
 * ("주류 제외"처럼 빼는 말은 제외). 청소년보호법상 청소년(만 19세 미만)에게 주류를 팔 수 없어
 * 시트에 한 줄 안내를 붙인다(store-submission-kit §3-6).
 */
const ALCOHOL_PATTERN = /소주|맥주|생맥|하이볼|와인|칵테일|막걸리|사케|위스키|주류(?!\s*제외)/;

function hasAlcoholBenefit(partner: Partner): boolean {
  if (partner.category === "주점") return true;
  const texts = [partner.benefit, ...(partner.affiliationBenefits?.map((item) => item.benefit) ?? [])];
  return texts.some((text) => !!text && ALCOHOL_PATTERN.test(text));
}

/** 혜택 본문. 항목이 여럿이면(위 splitBulletItems) 한 줄씩 "- "로 나눠 보여준다. */
function BenefitText({ text }: { text: string }) {
  const items = splitBulletItems(text);
  if (items.length === 1) return <Text style={styles.benefitText}>{text}</Text>;
  return (
    <View style={styles.bulletList}>
      {items.map((item, index) => (
        <Text key={index} style={styles.benefitText}>
          {"- "}
          {item}
        </Text>
      ))}
    </View>
  );
}

/**
 * "이용 방법" 안내. 문구가 하나면 라벨과 한 줄로 붙여 쓰던 기존 모양 그대로 두고,
 * " / "로 여럿이면(예: 기숙사 안내) 라벨을 제 줄로 떼고 그 아래 항목을 나눠 보여준다.
 */
function UsageNote({ note, color }: { note: string; color: string }) {
  const items = splitBulletItems(note);
  return (
    <View style={styles.usageNoteInline}>
      <Ionicons name="card-outline" size={11} color={color} style={styles.usageNoteIcon} />
      {items.length === 1 ? (
        <Text style={styles.usageNoteInlineText}>
          <Text style={[styles.usageNoteInlineLabel, { color }]}>이용 방법{"  "}</Text>
          {note}
        </Text>
      ) : (
        <View style={styles.usageNoteBlock}>
          <Text style={[styles.usageNoteInlineLabel, { color }]}>이용 방법</Text>
          {items.map((item, index) => (
            <Text key={index} style={styles.usageNoteInlineText}>
              {"- "}
              {item}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * 제휴 업체 상세. 혜택이 가장 중요하므로 카드로 강조한다.
 * benefit / address / hours / contact / link 는 값이 있을 때만 렌더한다.
 */
export default function PartnerSheet({ partner, onClose }: PartnerSheetProps) {
  // 손잡이(회색 줄)로 머리줄만 → 작게 → 보통 → 화면 위 끝까지 크기 조절(useSheetSizing).
  const { translateY, bodyHeight, panHandlers, onChromeLayout, onContentSizeChange } = useSheetSizing(onClose, {
    smallRatio: 0.22,
    midRatio: 0.45,
  });
  // 시트는 화면 맨 아래에 붙으므로 홈 인디케이터 높이만큼 안쪽 아래 여백을 더 준다.
  const insets = useSafeAreaInsets();
  const meta = partnerCategoryMeta(partner.category);
  // affiliationBenefits 로 예외가 걸린 소속은 그 예외 줄 안에서 이용 방법을
  // 보여준다. 예외가 없는 소속(기본 benefit 을 그대로 쓰는 소속)의 이용
  // 방법은 기본 혜택 줄 아래에 붙인다 — 어느 쪽이든 "혜택 + 그 밑 이용
  // 방법"이 하나의 구획으로 읽히게 하고, 별도 구분선으로 떼어놓지 않는다.
  const exceptionAffiliations = new Set(
    partner.affiliationBenefits?.map((item) => item.affiliation) ?? [],
  );
  // 예외로 빠지지 않은 소속은 기본 혜택을 그대로 받는다 — 이 소속들을
  // 칩으로 보여줘야 "이 혜택이 어느 제휴처 것인지" 한눈에 보인다.
  const baseAffiliations = (partner.affiliations ?? []).filter(
    (affiliation) => !exceptionAffiliations.has(affiliation),
  );
  // 기숙사 안내는 항상 학생증 안내 다음(맨 아래)에 오도록 정렬한다 — 소속
  // 배열에서의 순서와 무관하게 "일반 방법 먼저, 기숙사 방법 나중"을 보장한다.
  const dormUsageNote = PARTNER_AFFILIATION_USAGE_NOTES.기숙사;
  const baseUsageNotes = Array.from(
    new Set(baseAffiliations.map((affiliation) => PARTNER_AFFILIATION_USAGE_NOTES[affiliation])),
  ).sort((a, b) => (a === dormUsageNote ? 1 : b === dormUsageNote ? -1 : 0));

  return (
    <Animated.View style={[styles.sheet, { paddingBottom: 30 + insets.bottom, transform: [{ translateY }] }]}>
      <View onLayout={onChromeLayout}>
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

      <Animated.ScrollView
        onContentSizeChange={onContentSizeChange}
        style={[styles.body, { height: bodyHeight }]}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {partner.benefit && (
          <View
            style={[
              styles.benefitCard,
              {
                backgroundColor: `${meta.color}12`,
                borderLeftColor: meta.color,
              },
            ]}
          >
            <Text style={[styles.benefitLabel, { color: meta.color }]}>
              제휴 혜택
            </Text>
            {/*
              baseAffiliations 가 비면(모든 소속이 예외로 빠지면, 예: 네코노유부)
              이 기본 문구를 아무도 안 쓴다는 뜻 — 주인 없는 텍스트만 남아
              위쪽이 지저분해지므로 통째로 건너뛴다.
            */}
            {baseAffiliations.length > 0 && (
              <>
                <View style={styles.chipRow}>
                  {baseAffiliations.map((affiliation) => (
                    <View
                      key={affiliation}
                      style={[styles.sharedChip, { borderColor: meta.color }]}
                    >
                      <Text style={[styles.sharedChipText, { color: meta.color }]}>
                        {affiliation}
                      </Text>
                    </View>
                  ))}
                </View>
                <BenefitText text={partner.benefit} />
                {baseUsageNotes.map((note) => (
                  <UsageNote key={note} note={note} color={meta.color} />
                ))}
              </>
            )}

            {partner.affiliationBenefits?.map((item) => {
              const note = PARTNER_AFFILIATION_USAGE_NOTES[item.affiliation];
              return (
                <View key={item.affiliation} style={styles.exceptionRow}>
                  <View
                    style={[styles.exceptionChip, { backgroundColor: meta.color }]}
                  >
                    <Text style={styles.exceptionChipText}>
                      {item.affiliation}
                    </Text>
                  </View>
                  <BenefitText text={item.benefit} />
                  <UsageNote note={note} color={meta.color} />
                </View>
              );
            })}
          </View>
        )}

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
      </Animated.ScrollView>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    borderRadius: 20,
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
  benefitCard: {
    borderLeftWidth: 3,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 12,
  },
  benefitLabel: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  benefitText: { fontFamily: FONTS.regular, fontSize: 13.5, lineHeight: 20, color: COLORS.textPrimary },
  /** BenefitText 가 " / " 기준으로 여러 줄로 쪼갤 때 줄 사이 여백. */
  bulletList: { gap: 2 },
  /** 한 혜택 줄에 소속이 여럿 걸릴 수 있어(예: 소코아 4개 소속) 줄바꿈을 허용한다. */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 5,
  },
  /**
   * 기본 혜택을 공유하는 소속 칩. 예외 칩(꽉 찬 색)과 달리 테두리만 둔다 —
   * "이 소속들엔 다 같은 혜택"이라 예외처럼 눈길을 끌 필요가 없고,
   * 소속이 여럿(소코아 4개) 겹칠 때 꽉 찬 칩만큼 무거워 보이지 않게 한다.
   */
  sharedChip: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sharedChipText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  /**
   * 소속별 예외 혜택. 기본 혜택 아래에 얇은 구분선을 두고 이어 붙여,
   * 별개 항목이 아니라 "이 소속만 다르다"로 읽히게 한다.
   */
  exceptionRow: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.12)",
    gap: 5,
    alignItems: "flex-start",
  },
  exceptionChip: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  exceptionChipText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  /**
   * 이용 방법은 별도 구획이 아니라, 그것이 딸린 혜택 줄(기본 혜택 또는
   * 소속별 예외) 바로 아래에 이어 붙인다 — 구분선 없이 같은 구획으로 읽히게.
   */
  usageNoteInline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 6,
  },
  // 아이콘이 라벨 텍스트(fontSize 11)의 첫 줄 가운데에 오도록 살짝 내린다.
  usageNoteIcon: { marginTop: 1 },
  usageNoteInlineLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  usageNoteInlineText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
  // UsageNote 가 항목을 여럿(" / ")으로 쪼갤 때: 라벨 줄 + 그 아래 "- 항목" 줄들.
  usageNoteBlock: { flex: 1, gap: 2 },
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
    borderRadius: 12,
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
