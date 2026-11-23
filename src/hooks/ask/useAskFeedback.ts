import { useCallback, type MutableRefObject } from "react";
import { sendAskFeedback, sendFlowFeedback, type AskAuth, type AskFeedbackReason } from "../../apis/ask";
import * as haptics from "../../lib/haptics";
import type { Facility } from "../../types";
import { askOffices } from "../../utils/ask/officeAsk";
import type { ChatMessageOf } from "../../utils/ask/chatTypes";
import { handoffAfterFeedback } from "../../utils/ask/handoff";
import type { ChatMessagesApi } from "./useChatMessages";

type Feedback = ChatMessageOf<"feedback">;

/**
 * '해결됐나요?' 응답과 '해결 안 됨'의 이유. 서버 답이면 그 기록에, 앱 안내 흐름 답이면 익명 기록에 남긴다(실패해도 화면은 그대로).
 * 해결이 안 됐으면 담당 부서(바로 위 답의 전화, 없으면 질문으로 찾은 부서)와 운영진 문의 카드를 잇는다.
 * 콜백은 참조가 바뀌지 않는다(대화·auth·시설은 ref 로 읽는다).
 */
export function useAskFeedback({
  chat,
  authRef,
  conversationId,
  facilitiesRef,
}: {
  chat: ChatMessagesApi;
  authRef: MutableRefObject<AskAuth | null>;
  conversationId: string;
  facilitiesRef: MutableRefObject<readonly Facility[]>;
}) {
  const { setMessages, messagesRef, push } = chat;

  const reportFeedback = useCallback(
    (message: Feedback, resolved: boolean, reason?: AskFeedbackReason) => {
      const auth = authRef.current;
      if (message.logId && auth) {
        sendAskFeedback(message.logId, conversationId, resolved, auth, reason).catch(() => {});
      } else if (message.flowRef && message.clientId) {
        sendFlowFeedback({ question: message.question, ...message.flowRef, resolved, clientId: message.clientId, reason }).catch(() => {});
      }
    },
    [authRef, conversationId],
  );

  const answerFeedback = useCallback(
    (message: Feedback, resolved: boolean) => {
      if (message.resolved !== null) return;
      haptics.selection();
      setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, resolved } : item)));
      // 서버 답이면 그 기록에, 앱 안내 흐름 답이면 익명 기록에 응답을 남긴다(무엇이 해결 안 됐는지 알아야 고친다). 실패해도 화면은 그대로.
      reportFeedback(message, resolved);
      if (resolved) {
        push({ role: "text", text: "다행이에요. 다른 것도 궁금하면 언제든 물어보세요." });
        return;
      }
      // 바로 위 답에 담당 부서 전화가 있으면 그 부서로 안내하고, 해결이 안 됐으면 운영진에게 이 대화를 넘길 수 있게 한다.
      const { handoff, phone } = handoffAfterFeedback(messagesRef.current, message);
      if (phone) {
        push({ role: "text", text: `위 안내의 담당 부서(${phone.label} ${phone.phone})에 물어보면 가장 정확해요.` }, handoff);
        return;
      }
      const offices = askOffices(facilitiesRef.current, message.question).slice(0, 3);
      push(
        offices.length > 0
          ? { role: "offices", intro: "담당 부서에 직접 물어보면 가장 정확해요.", offices }
          : { role: "text", text: "더 도와드리지 못해 아쉬워요. 위 학교 안내 페이지의 담당 부서로 문의해 보세요." },
        handoff,
      );
    },
    [setMessages, messagesRef, push, reportFeedback, facilitiesRef],
  );

  /** '해결 안 됨' 뒤 이유 한 번 누르기. 한 번 고르면 바꾸지 않는다(버튼이 사라진다). */
  const chooseReason = useCallback(
    (message: Feedback, reason: AskFeedbackReason) => {
      if (message.resolved !== false || message.reason) return;
      haptics.selection();
      setMessages((prev) => prev.map((item) => (item.id === message.id && item.role === "feedback" ? { ...item, reason } : item)));
      reportFeedback(message, false, reason);
    },
    [setMessages, reportFeedback],
  );

  return { answerFeedback, chooseReason };
}
