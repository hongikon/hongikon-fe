import type { MutableRefObject, RefObject } from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, type TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { RADIUS } from "../../../constants/spacing";
import { askStyles } from "../askStyles";

/** react-native-web 여러 줄 칸(textarea)의 줄 수(rows). RN 타입에는 없어 따로 넘긴다. */
const WEB_ONE_ROW: object = Platform.OS === "web" ? { rows: 1 } : {};

/** 웹 입력칸의 브라우저 기본 포커스 테두리(분홍·파랑 바깥선)를 없앤다. 포커스는 입력 상자 테두리 색으로 보인다. */
const WEB_NO_OUTLINE = Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as unknown as TextStyle) : null;

interface Props {
  /** 앱 탭(둥근 입력 상자·안내 문구 위)인지, 웹 /dev/ask(한 줄 입력줄)인지. */
  appMode: boolean;
  inputRef: RefObject<TextInput | null>;
  input: string;
  onChangeText: (text: string) => void;
  /** 웹 한글 조합 중 Enter 를 보낼 때 읽는 최신 입력 값. */
  latestInputRef: MutableRefObject<string>;
  /** 이 글로 묻는다. */
  onSend: (text: string) => void;
  /** 서버 답을 받는 중 — 보내기 버튼이 멈춤으로 바뀐다. */
  stoppable: boolean;
  onStop: () => void;
  canSend: boolean;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  /** 입력줄 아래 여백(탭 바·안전 영역, 키보드가 떠 있으면 0). */
  bottom: number;
  /** 입력줄 위 한 줄(오늘 남은 질문 수 등). */
  note?: string | null;
}

/** 질문 입력줄. 앱 탭은 안내 문구를 입력칸 위에 두고(11-11 운영진), 웹 /dev/ask 는 예전 한 줄 입력줄. */
export default function AskComposer({
  appMode,
  inputRef,
  input,
  onChangeText,
  latestInputRef,
  onSend,
  stoppable,
  onStop,
  canSend,
  focused,
  onFocus,
  onBlur,
  bottom,
  note,
}: Props) {
  if (appMode) {
    return (
      <View style={[styles.composerWrap, { paddingBottom: 6 + bottom }]}>
        {/* 안내 문구는 입력칸 위에(11-11 운영진 — 키보드가 올라와도 입력칸이 키보드 바로 위에 붙고 안내는 그 위에 보이게). */}
        <Text style={styles.disclaimer} numberOfLines={2}>
          {note ? `${note} · ` : ""}AI 답변은 틀릴 수 있어요. 중요한 내용은 원문에서 확인하세요.
        </Text>
        <View style={[styles.composerBox, focused && styles.composerBoxFocused]}>
          <TextInput
            ref={inputRef}
            style={[styles.composerInput, WEB_NO_OUTLINE]}
            value={input}
            onChangeText={onChangeText}
            placeholder="질문을 입력하세요"
            placeholderTextColor={COLORS.textPlaceholder}
            multiline
            // 웹 여러 줄 칸은 기본 2줄 높이라 한 줄로 시작한다(앱은 minHeight 로 맞춤).
            {...WEB_ONE_ROW}
            maxLength={200}
            returnKeyType="send"
            onSubmitEditing={() => onSend(input)}
            submitBehavior="submit"
            onFocus={onFocus}
            onBlur={onBlur}
            // 웹(react-native-web)은 여러 줄 칸에서 submitBehavior 를 보지 않아 Enter 가 줄바꿈이 됐다(11-09).
            // Enter 는 보내기, Shift+Enter 는 줄바꿈. 한글 조합 중 Enter 는 글자가 확정된 뒤 보낸다.
            onKeyPress={
              Platform.OS === "web"
                ? (event) => {
                    const native = event.nativeEvent as unknown as { key?: string; shiftKey?: boolean; isComposing?: boolean; keyCode?: number };
                    if (native.key !== "Enter" || native.shiftKey) return;
                    event.preventDefault();
                    // 조합 중이면 글자가 확정돼 칸에 들어간 뒤(다음 차례) 칸의 실제 값으로 보낸다.
                    const field = (event as unknown as { target?: { value?: string } }).target;
                    if (native.isComposing || native.keyCode === 229) setTimeout(() => onSend(field?.value ?? latestInputRef.current), 0);
                    else onSend(input);
                  }
                : undefined
            }
            accessibilityLabel="학교 일 물어보기"
          />
          {stoppable ? (
            <TouchableOpacity style={styles.composerSend} onPress={onStop} accessibilityRole="button" accessibilityLabel="답 받기 멈추기">
              <View style={styles.stopIcon} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.composerSend, !canSend && styles.composerSendOff]}
              onPress={() => onSend(input)}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="보내기"
            >
              <Ionicons name="arrow-up" size={18} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
  return (
    <>
      {note ? <Text style={styles.composerNote}>{note}</Text> : null}
      <View style={[styles.composer, { paddingBottom: 10 + bottom }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, WEB_NO_OUTLINE]}
          value={input}
          onChangeText={onChangeText}
          placeholder="예: 휴학 신청 기간"
          placeholderTextColor={COLORS.textPlaceholder}
          returnKeyType="send"
          onSubmitEditing={() => onSend(input)}
          submitBehavior="submit"
          accessibilityLabel="학교 일 물어보기"
        />
        {stoppable ? (
          <TouchableOpacity style={styles.send} onPress={onStop} accessibilityRole="button" accessibilityLabel="답 받기 멈추기">
            <Ionicons name="stop" size={16} color={COLORS.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.send, !canSend && askStyles.sendOff]}
            onPress={() => onSend(input)}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="보내기"
          >
            <Ionicons name="arrow-up" size={20} color={COLORS.white} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  composerNote: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: "center", paddingTop: 6 },
  composerWrap: { paddingHorizontal: 12, paddingTop: 6, backgroundColor: COLORS.white, gap: 6 },
  composerBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  composerBoxFocused: { borderColor: COLORS.primary },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingTop: Platform.OS === "ios" ? 9 : 6,
    paddingBottom: Platform.OS === "ios" ? 9 : 6,
    fontSize: 16,
    lineHeight: 21,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  composerSend: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  composerSendOff: { backgroundColor: COLORS.toggleOff },
  stopIcon: { width: 12, height: 12, borderRadius: 2, backgroundColor: COLORS.white },
  disclaimer: { fontSize: 11, lineHeight: 15, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: "center" },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
