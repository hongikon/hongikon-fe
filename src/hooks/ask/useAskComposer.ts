import { useCallback, useRef, useState } from "react";
import type { TextInput } from "react-native";
import { useLatestRef } from "./useLatestRef";

/** 질문 입력칸의 글·포커스. */
export function useAskComposer() {
  const [input, setInput] = useState("");
  // 웹 한글 입력 중 Enter 는 글자를 확정하는 키라 그 순간의 값이 아직 덜 들어와 있다 — 확정된 뒤 최신 값으로 보낸다.
  const latestInputRef = useLatestRef(input);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);
  return { input, setInput, latestInputRef, focused, onFocus, onBlur, inputRef };
}
