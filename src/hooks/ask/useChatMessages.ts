import { useCallback, useRef, useState } from "react";
import type { ChatMessage, NewMessage } from "../../utils/ask/chatTypes";
import { useLatestRef } from "./useLatestRef";

/**
 * 물어보기 대화 목록. push 는 말풍선을 잇고 붙인 id 를 돌려준다 — id 는 상태 갱신 함수 밖에서 매긴다
 * (개발 모드에서 갱신 함수가 두 번 돌아도 겹치지 않게). messagesRef 는 참조가 바뀌지 않는 콜백이 지금 대화를 읽을 때.
 */
export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useLatestRef(messages);
  const nextId = useRef(1);

  const push = useCallback((...items: NewMessage[]) => {
    const added = items.map((item) => ({ ...item, id: nextId.current++ }) as ChatMessage);
    setMessages((prev) => [...prev, ...added]);
    return added.map((item) => item.id);
  }, []);

  return { messages, setMessages, messagesRef, nextId, push };
}

export type ChatMessagesApi = ReturnType<typeof useChatMessages>;
