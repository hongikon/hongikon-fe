import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { askStyles, botBubbleStyle } from "../askStyles";

/** 웹 /dev/ask 대화 맨 위 안내 말풍선. */
export function AskIntro({ appMode }: { appMode: boolean }) {
  return (
    <View style={botBubbleStyle(appMode)}>
      <Text style={askStyles.botText}>
        학교에서 해야 할 일을 물어보세요. 필요한 건 몇 가지 되물어서, 어떻게 하면 되는지와 어디에 연락하면 되는지 알려 드려요.
      </Text>
    </View>
  );
}

/** 대화가 없을 때 가운데 인사(Claude·ChatGPT 앱처럼, 앱 탭만). */
export function AskEmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubble-ellipses" size={28} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>무엇이 궁금하세요?</Text>
      <Text style={styles.emptyDesc}>휴학·수강·장학·시설처럼 학교 일을 물으면{"\n"}학교 공식 안내를 찾아 답해요.</Text>
    </View>
  );
}

/** 대화 아래 — (인증 없이 묻는 중) 기다림 말풍선, 웹 /dev/ask 의 안내 문구. */
export function AskListFooter({ appMode, pending, hasAuth }: { appMode: boolean; pending: boolean; hasAuth: boolean }) {
  return (
    <>
      {pending && !hasAuth ? (
        <View style={[askStyles.botBubble, styles.pending]}>
          <Text style={askStyles.botText}>안내를 찾아 답을 쓰고 있어요…</Text>
        </View>
      ) : null}
      {appMode ? null : (
        <Text style={styles.footnote}>
          학교 홈페이지 안내와 운영진이 확인한 내용으로 답해요. 학교 공식 상담이 아니니 정확한 건 담당 부서에 확인해 주세요.
          {hasAuth
            ? " 질문과 답은 답변 개선을 위해 기록돼요(1년 보관). 학번·연락처 같은 개인정보는 적지 말아 주세요."
            : ""}
        </Text>
      )}
    </>
  );
}

/** 위로 올려 읽는 중일 때 보이는 '맨 아래로' 버튼. */
export function JumpToBottomButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.jump} activeOpacity={0.8} onPress={onPress} accessibilityRole="button" accessibilityLabel="맨 아래로">
      <Ionicons name="arrow-down" size={18} color={COLORS.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40, gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySoft, marginBottom: 4 },
  emptyTitle: { fontSize: 24, lineHeight: 32, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: "center" },
  emptyDesc: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: "center" },
  jump: {
    position: "absolute",
    alignSelf: "center",
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  pending: { marginTop: 10 },
  footnote: { marginTop: 6, fontSize: 11, lineHeight: 16, fontFamily: FONTS.regular, color: COLORS.textTertiary },
});
