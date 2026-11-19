import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../../constants/colors";
import { FONTS, TYPE } from "../../../constants/typography";
import { RADIUS } from "../../../constants/spacing";
import ScreenHeader from "../../common/ScreenHeader";

interface Props {
  appMode: boolean;
  beta: boolean;
  /** 대화가 있으면 오른쪽에 '초기화'. */
  hasMessages: boolean;
  onBack?: () => void;
  /** 받고 있는 답을 끊고 대화를 지운다. */
  onClear: () => void;
}

/** 물어보기 머리 — 제목(앱 탭은 BETA 표시), 뒤로 가기, 대화 초기화. */
function AskChatHeader({ appMode, beta, hasMessages, onBack, onClear }: Props) {
  return (
    <ScreenHeader
      title="물어보기"
      onBack={onBack}
      card={!appMode}
      border={false}
      children={
        beta ? (
          <View style={styles.titleRow} accessibilityRole="header" accessibilityLabel="물어보기, 베타">
            <Text style={styles.titleText}>물어보기</Text>
            <Text style={styles.beta}>BETA</Text>
          </View>
        ) : undefined
      }
      right={
        hasMessages ? (
          <TouchableOpacity
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="초기화 — 대화 지우기"
            style={styles.clear}
          >
            <Text style={styles.clearText}>초기화</Text>
          </TouchableOpacity>
        ) : appMode ? (
          <View style={styles.clearSlot} />
        ) : undefined
      }
    />
  );
}

export default memo(AskChatHeader);

const styles = StyleSheet.create({
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  titleText: { ...TYPE.headline, color: COLORS.textPrimary },
  beta: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  clearSlot: { width: 44 },
  clear: { paddingHorizontal: 6, paddingVertical: 4 },
  clearText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
});
