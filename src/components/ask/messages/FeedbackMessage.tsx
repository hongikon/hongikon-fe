import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { RADIUS } from "../../../constants/spacing";
import { ASK_FEEDBACK_REASONS } from "../../../apis/ask";
import type { ChatMessageOf } from "../../../utils/ask/chatTypes";
import { askStyles, botBubbleStyle } from "../askStyles";
import type { AskMessageActions } from "./types";

type Props = { item: ChatMessageOf<"feedback">; appMode: boolean; actions: AskMessageActions };

/** '해결 안 됨' 뒤 이유 한 번 누르기. 고르면 고맙다는 한 줄만 남는다. 기록할 곳(서버 기록·안내 흐름)이 없으면 묻지 않는다. */
function FeedbackReasons({ item, actions }: Omit<Props, "appMode">) {
  if (item.resolved !== false || (!item.logId && !item.flowRef)) return null;
  if (item.reason) {
    const label = ASK_FEEDBACK_REASONS.find((r) => r.code === item.reason)?.label;
    return <Text style={styles.reasonDone}>{label ? `'${label}' 알려 주셔서 고마워요. 운영진이 확인하고 고칠게요.` : null}</Text>;
  }
  return (
    <View style={styles.reasonBox}>
      <Text style={styles.reasonTitle}>어떤 점이 아쉬웠나요?</Text>
      <View style={styles.reasonRow}>
        {ASK_FEEDBACK_REASONS.map((r) => (
          <TouchableOpacity
            key={r.code}
            style={styles.reasonChip}
            activeOpacity={0.7}
            onPress={() => actions.chooseReason(item, r.code)}
            accessibilityRole="button"
            accessibilityLabel={r.label}
          >
            <Text style={styles.reasonChipText}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/** 답 뒤 '해결됐나요?'. 앱 탭은 엄지 아이콘 두 개, 웹 /dev/ask 는 글 버튼 말풍선. */
export default function FeedbackMessage({ item, appMode, actions }: Props) {
  if (appMode) {
    // Claude·ChatGPT 앱처럼 답 바로 아래 엄지 아이콘 두 개. 아래를 누르면 담당 부서·운영진 문의로 잇는다.
    return (
      <View>
        <View style={styles.feedbackIcons}>
          {item.resolved !== false ? (
            <TouchableOpacity
              style={styles.feedbackIcon}
              disabled={item.resolved !== null}
              onPress={() => actions.answerFeedback(item, true)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={item.resolved ? "도움이 됐어요(선택됨)" : "도움이 됐어요"}
            >
              <Ionicons name={item.resolved ? "thumbs-up" : "thumbs-up-outline"} size={17} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ) : null}
          {item.resolved !== true ? (
            <TouchableOpacity
              style={styles.feedbackIcon}
              disabled={item.resolved !== null}
              onPress={() => actions.answerFeedback(item, false)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={item.resolved === false ? "해결되지 않았어요(선택됨)" : "해결되지 않았어요"}
            >
              <Ionicons name={item.resolved === false ? "thumbs-down" : "thumbs-down-outline"} size={17} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <FeedbackReasons item={item} actions={actions} />
      </View>
    );
  }
  return (
    <View style={botBubbleStyle(appMode)}>
      <Text style={askStyles.botText}>궁금한 점이 해결됐나요?</Text>
      {item.resolved === null ? (
        <View style={styles.feedbackRow}>
          <TouchableOpacity
            style={styles.feedbackButton}
            activeOpacity={0.7}
            onPress={() => actions.answerFeedback(item, true)}
            accessibilityRole="button"
            accessibilityLabel="네, 해결됐어요"
          >
            <Text style={styles.feedbackText}>네, 해결됐어요</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.feedbackButton}
            activeOpacity={0.7}
            onPress={() => actions.answerFeedback(item, false)}
            accessibilityRole="button"
            accessibilityLabel="아니요, 더 알고 싶어요"
          >
            <Text style={styles.feedbackText}>아니요, 더 알고 싶어요</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.feedbackDone}>{item.resolved ? "네, 해결됐어요" : "아니요, 더 알고 싶어요"}</Text>
      )}
      <FeedbackReasons item={item} actions={actions} />
    </View>
  );
}

const styles = StyleSheet.create({
  feedbackIcons: { flexDirection: "row", gap: 4, marginTop: -10 },
  feedbackIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  reasonBox: { marginTop: 6 },
  reasonTitle: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary, marginBottom: 6 },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reasonChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: COLORS.white,
  },
  reasonChipText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  reasonDone: { marginTop: 6, fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  feedbackRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  feedbackButton: {
    paddingHorizontal: 12,
    height: 36,
    justifyContent: "center",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  feedbackText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  feedbackDone: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textTertiary },
});
