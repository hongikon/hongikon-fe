import { StyleSheet } from "react-native";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { RADIUS } from "../../constants/spacing";

/** 물어보기 말풍선·버튼이 함께 쓰는 모양. 한 말풍선에서만 쓰는 모양은 그 컴포넌트 파일에 둔다. */
export const askStyles = StyleSheet.create({
  botPlain: { maxWidth: "100%", alignSelf: "stretch", backgroundColor: "transparent", borderRadius: 0, padding: 0, gap: 12 },
  userApp: { maxWidth: "82%", backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingHorizontal: 16 },
  userTextApp: { fontSize: 16, lineHeight: 22, fontFamily: FONTS.regular, color: COLORS.white },
  botBubble: {
    maxWidth: "92%",
    alignSelf: "flex-start",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderTopLeftRadius: 6,
    padding: 14,
    gap: 10,
  },
  botText: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  userBubble: {
    maxWidth: "80%",
    alignSelf: "flex-end",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    borderTopRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.medium, color: COLORS.white },
  // 되묻는 버튼은 한 줄에 하나씩(고객센터 챗봇의 선택지 목록처럼) — 글이 길어도 잘리지 않게.
  options: { gap: 6 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.fill,
  },
  optionText: { flex: 1, fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  lead: { fontFamily: FONTS.semibold },
  followTitle: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textTertiary, marginTop: 2 },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 2,
    maxWidth: "100%",
  },
  mapButtonText: { flexShrink: 1, fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.white },
  checked: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  sourceToggle: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 10, paddingVertical: 4 },
  sourceToggleText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  sendOff: { backgroundColor: COLORS.toggleOff },
});

// 앱 탭은 Claude·ChatGPT 앱처럼 — 답은 말풍선 없이 화면 폭 그대로, 내 질문만 오른쪽 남색 말풍선(11-01 브랜드색 강조).
const BOT_APP = [askStyles.botBubble, askStyles.botPlain];
const USER_APP = [askStyles.userBubble, askStyles.userApp];
const USER_TEXT_APP = [askStyles.userText, askStyles.userTextApp];

/** 봇 말풍선 모양(앱 탭은 말풍선 없이 화면 폭). 매번 같은 참조를 돌려준다. */
export function botBubbleStyle(appMode: boolean) {
  return appMode ? BOT_APP : askStyles.botBubble;
}

/** 내 질문 말풍선과 글 모양. */
export function userBubbleStyle(appMode: boolean) {
  return appMode ? { bubble: USER_APP, text: USER_TEXT_APP } : { bubble: askStyles.userBubble, text: askStyles.userText };
}
