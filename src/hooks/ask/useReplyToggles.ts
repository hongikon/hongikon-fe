import { useCallback } from "react";
import type { ChatMessage } from "../../utils/ask/chatTypes";

/** 서버 답의 '연락처·링크 더 보기'(moreOpen)·'살펴본 과정'(stepsOpen) 펼치고 접기. 참조가 바뀌지 않는다. */
export function useReplyToggles(setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void) {
  return useCallback(
    (id: number, key: "moreOpen" | "stepsOpen") =>
      setMessages((prev) => prev.map((message) => (message.id === id && message.role === "reply" ? { ...message, [key]: !message[key] } : message))),
    [setMessages],
  );
}
