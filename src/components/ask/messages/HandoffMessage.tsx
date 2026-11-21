import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { RADIUS } from "../../../constants/spacing";
import { ATTACH_MAX_IMAGES } from "../../../utils/attachImages";
import type { ChatMessageOf } from "../../../utils/ask/chatTypes";
import { askStyles, botBubbleStyle } from "../askStyles";
import type { AskMessageActions, AskMessageEnv } from "./types";

/**
 * 운영진에게 물어보기 카드 — 보낼 대화를 미리 보이고, 더 알고 싶은 점·답 받을 이메일(선택)·참고 사진(로그인 시)을 받아
 * 학생이 보내기를 눌러야만 보낸다.
 */
export default function HandoffMessage({ item, env, actions }: { item: ChatMessageOf<"handoff">; env: AskMessageEnv; actions: AskMessageActions }) {
  const { updateHandoff } = actions;
  return (
    <View style={botBubbleStyle(env.appMode)}>
      <Text style={styles.handoffTitle}>운영진에게 물어보기</Text>
      {item.status === "sent" ? (
        <Text style={askStyles.botText}>
          운영진에게 보냈어요. 확인한 뒤{item.contact.trim() ? " 적어 주신 이메일로" : ""} 답변드릴게요.
        </Text>
      ) : (
        <>
          <Text style={styles.handoffDesc}>
            아래 대화와 남기신 말을 운영진 문의함으로 보내요.{"\n"}이메일을 적으면 그 주소로 답을 드려요(선택).
          </Text>
          <View style={styles.handoffPreview}>
            <Text style={styles.handoffPreviewText} numberOfLines={4}>
              질문: {item.question}
              {item.answer ? `\n홍익온 답: ${item.answer.replace(/\s+/g, " ")}` : ""}
            </Text>
          </View>
          <TextInput
            style={[styles.handoffInput, styles.handoffNote]}
            value={item.note}
            onChangeText={(note) => updateHandoff(item.id, { note, error: null })}
            placeholder="더 알고 싶은 점을 적어 주세요"
            placeholderTextColor={COLORS.textPlaceholder}
            multiline
            maxLength={400}
            editable={item.status === "editing"}
            accessibilityLabel="운영진에게 더 알고 싶은 점"
          />
          <TextInput
            style={styles.handoffInput}
            value={item.contact}
            onChangeText={(contact) => updateHandoff(item.id, { contact, error: null })}
            placeholder="답 받을 이메일 (선택)"
            placeholderTextColor={COLORS.textPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
            editable={item.status === "editing"}
            accessibilityLabel="답 받을 이메일"
          />
          {env.canAttachImages ? (
            <View style={styles.attachRow}>
              {(item.images ?? []).map((image) => (
                <View key={image.uri} style={styles.attachThumbWrap}>
                  <Image source={{ uri: image.uri }} style={styles.attachThumb} accessibilityLabel="붙인 사진" />
                  {item.status === "editing" ? (
                    <TouchableOpacity
                      style={styles.attachRemove}
                      onPress={() => updateHandoff(item.id, { images: (item.images ?? []).filter((x) => x.uri !== image.uri), error: null })}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="사진 빼기"
                    >
                      <Ionicons name="close" size={12} color={COLORS.white} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {(item.images ?? []).length < ATTACH_MAX_IMAGES && item.status === "editing" ? (
                <TouchableOpacity
                  style={styles.attachAdd}
                  activeOpacity={0.7}
                  onPress={() => actions.addHandoffImages(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`사진 붙이기, ${(item.images ?? []).length}장 붙임, 최대 ${ATTACH_MAX_IMAGES}장`}
                >
                  <Ionicons name="image-outline" size={18} color={COLORS.textSecondary} />
                  <Text style={styles.attachAddText}>사진 {(item.images ?? []).length}/{ATTACH_MAX_IMAGES}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {(item.images ?? []).length > 0 ? (
            <Text style={styles.attachHint}>학번·전화번호처럼 개인정보가 보이면 가리고 붙여 주세요. 사진은 확인이 끝나면 지워요.</Text>
          ) : null}
          {item.error ? <Text style={styles.handoffError}>{item.error}</Text> : null}
          <TouchableOpacity
            style={[styles.handoffSend, item.status === "sending" && askStyles.sendOff]}
            activeOpacity={0.8}
            disabled={item.status === "sending"}
            onPress={() => actions.sendHandoff(item)}
            accessibilityRole="button"
            accessibilityLabel="운영진에게 보내기"
          >
            <Text style={styles.handoffSendText}>{item.status === "sending" ? "보내는 중이에요" : "보내기"}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  handoffTitle: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 4 },
  handoffDesc: { fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  handoffPreview: { marginTop: 8, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.background },
  handoffPreviewText: { fontSize: 12, lineHeight: 18, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  handoffInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  handoffNote: { minHeight: 72, textAlignVertical: "top" },
  attachRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  attachThumbWrap: { width: 56, height: 56 },
  attachThumb: { width: 56, height: 56, borderRadius: RADIUS.md, backgroundColor: COLORS.background },
  attachRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.textPrimary,
  },
  attachAdd: {
    height: 56,
    minWidth: 56,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  attachAddText: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  attachHint: { marginTop: 6, fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  handoffError: { marginTop: 6, fontSize: 12, fontFamily: FONTS.regular, color: COLORS.danger },
  handoffSend: { marginTop: 10, borderRadius: RADIUS.md, paddingVertical: 11, alignItems: "center", backgroundColor: COLORS.primary },
  handoffSendText: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.white },
});
