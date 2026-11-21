import { Animated, StyleSheet, Text } from 'react-native'
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";

import { useThinkingLine } from '../../../hooks/ask/parts/useThinkingLine'

/** 기다린 지 이만큼 지나면 경과 초를 붙인다 — 짧은 답에는 숫자가 깜빡이지 않게. */
const ELAPSED_AFTER_SECONDS = 3;

/** 서버가 지금 하는 일 한 줄. 글이 바뀌면 살짝 떠오르며 바뀌고, 그동안 은은하게 깜빡인다. */
export default function ThinkingLine({ text }: { text: string }) {
  const { pulse, enter, seconds } = useThinkingLine({ text })
  return (
    <Animated.View
      style={[
        styles.thinkingRow,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
    >
      <Animated.View style={[styles.thinkingDot, { opacity: pulse }]} />
      <Animated.Text style={[styles.thinkingText, { opacity: pulse }]} numberOfLines={1}>
        {text}
      </Animated.Text>
      {seconds >= ELAPSED_AFTER_SECONDS ? (
        <Text style={styles.thinkingSeconds} accessibilityElementsHidden importantForAccessibility="no">
          {seconds}초
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  thinkingRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 22 },
  thinkingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  thinkingSeconds: { fontSize: 13, lineHeight: 20, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  thinkingText: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontFamily: FONTS.medium, color: COLORS.primary },
});
