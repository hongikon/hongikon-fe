import { useCallback, type MutableRefObject } from "react";
import * as haptics from "../../lib/haptics";
import type { GreetingGuide } from "../../utils/askGreeting";
import type { ChatMessageOf } from "../../utils/ask/chatTypes";
import { followTarget, lastUserText, stepMessages } from "../../utils/ask/conversation";
import type { ChatMessagesApi } from "./useChatMessages";

/**
 * 앱 안내 흐름 버튼 — 되묻기 고르기, 인사 뒤 안내 칩, '이어서 물어보기'. 고른 버튼은 사용자 말풍선으로 남고 그 버튼 묶음은 접힌다.
 * 콜백은 참조가 바뀌지 않는다(지금 대화·pending 은 ref 로 읽는다).
 */
export function useFlowChoices({
  chat,
  pendingRef,
  atBottomRef,
}: {
  chat: ChatMessagesApi;
  pendingRef: MutableRefObject<boolean>;
  atBottomRef: MutableRefObject<boolean>;
}) {
  const { setMessages, messagesRef, push } = chat;

  const choose = useCallback(
    (message: ChatMessageOf<"question">, label: string, next: string) => {
      if (message.chosen !== null) return;
      haptics.selection();
      // '해결 안 됨'일 때 부서를 찾을 수 있게 처음 질문 글을 넘긴다(버튼 글자로는 부서가 잘 안 걸린다).
      const lastQuestion = lastUserText(messagesRef.current, label);
      setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, chosen: label } : item)));
      push({ role: "user", text: label }, ...stepMessages(message.flowId, next, lastQuestion));
    },
    [messagesRef, setMessages, push],
  );

  const chooseGuide = useCallback(
    (message: ChatMessageOf<"greeting">, guide: GreetingGuide) => {
      if (message.chosen !== null || pendingRef.current) return;
      haptics.selection();
      atBottomRef.current = true;
      setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, chosen: guide.label } : item)));
      push({ role: "user", text: guide.label }, ...stepMessages(guide.flowId, guide.nodeId, guide.label));
    },
    [pendingRef, atBottomRef, setMessages, push],
  );

  /** 답 아래 '이어서 물어보기' 버튼. 한 번 누르면 그 답의 버튼은 접는다. */
  const follow = useCallback(
    (message: ChatMessageOf<"answer">, label: string, next: string) => {
      if (message.followed) return;
      haptics.selection();
      setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, followed: true } : item)));
      // 'course-table/start' 처럼 흐름 id 가 붙은 버튼은 다른 안내로 넘어간다(주제표 see).
      const { flowId, nodeId } = followTarget(message.flowId, next);
      push({ role: "user", text: label }, ...stepMessages(flowId, nodeId, message.question));
    },
    [setMessages, push],
  );

  return { choose, chooseGuide, follow };
}
