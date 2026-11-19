import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { RADIUS } from "../../../constants/spacing";
import type { ChatMessageOf } from "../../../utils/ask/chatTypes";
import { askStyles, botBubbleStyle } from "../askStyles";
import type { AskMessageActions } from "./types";

/** 안내 흐름이 버튼으로 되묻는 말풍선. 고르면 버튼은 사라진다. */
export function QuestionMessage({ item, appMode, actions }: { item: ChatMessageOf<"question">; appMode: boolean; actions: AskMessageActions }) {
  return (
    <View style={botBubbleStyle(appMode)}>
      <Text style={askStyles.botText}>{item.node.text}</Text>
      {item.chosen === null ? (
        <View style={askStyles.options}>
          {item.node.options.map((option) => (
            <TouchableOpacity
              key={option.next + option.label}
              style={askStyles.option}
              activeOpacity={0.7}
              onPress={() => actions.choose(item, option.label, option.next)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              <Text style={askStyles.optionText}>{option.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {item.viaServer ? <Text style={askStyles.checked}>질문 뜻을 풀어 찾은 안내예요</Text> : null}
    </View>
  );
}

/** 인사에 앱이 바로 하는 답 — 요즘 많이 찾는 안내(없으면 기본 안내) 칩. */
export function GreetingMessage({ item, appMode, actions }: { item: ChatMessageOf<"greeting">; appMode: boolean; actions: AskMessageActions }) {
  return (
    <View style={botBubbleStyle(appMode)}>
      <Text style={askStyles.botText}>안녕하세요! 학교에서 궁금한 걸 편하게 물어보세요.</Text>
      {item.chosen === null && item.guides.length > 0 ? (
        <>
          <Text style={askStyles.followTitle}>{item.popular ? "요즘 많이 찾는 안내" : "이런 걸 물어볼 수 있어요"}</Text>
          <View style={styles.examples}>
            {item.guides.map((guide) => (
              <TouchableOpacity
                key={`${guide.flowId}/${guide.nodeId}`}
                style={styles.example}
                activeOpacity={0.7}
                onPress={() => actions.chooseGuide(item, guide)}
                accessibilityRole="button"
                accessibilityLabel={`${guide.label} 안내 보기`}
              >
                <Text style={styles.exampleText}>{guide.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  examples: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  example: {
    paddingHorizontal: 12,
    height: 34,
    justifyContent: "center",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  exampleText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textPrimary },
});
