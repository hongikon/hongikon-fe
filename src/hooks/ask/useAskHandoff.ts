import { useCallback, type MutableRefObject } from "react";
import type { AskAuth } from "../../apis/ask";
import { getErrorMessage } from "../../apis/client";
import { submitFeedback } from "../../apis/feedback";
import { uploadReportImage } from "../../apis/reports";
import * as haptics from "../../lib/haptics";
import { pickAttachImages } from "../../utils/map/report/attachImages";
import type { ChatMessage, ChatMessageOf } from "../../utils/ask/chatTypes";
import { handoffContent, isContactValid } from "../../utils/ask/handoff";

type Handoff = ChatMessageOf<"handoff">;

/**
 * 운영진에게 물어보기 카드 — 칸 고치기, 참고 사진 붙이기, 보내기(기존 문의하기 /feedback).
 * 콜백은 참조가 바뀌지 않는다(auth 는 ref 로 읽는다).
 */
export function useAskHandoff({
  setMessages,
  authRef,
}: {
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void;
  authRef: MutableRefObject<AskAuth | null>;
}) {
  const updateHandoff = useCallback(
    (id: number, patch: Partial<Handoff>) =>
      setMessages((prev) => prev.map((item) => (item.id === id && item.role === "handoff" ? { ...item, ...patch } : item))),
    [setMessages],
  );

  const addHandoffImages = useCallback(
    async (message: Handoff) => {
      const current = message.images ?? [];
      const result = await pickAttachImages(current);
      if (result.images.length !== current.length || result.error) {
        updateHandoff(message.id, { images: result.images, error: result.error });
      }
    },
    [updateHandoff],
  );

  const sendHandoff = useCallback(
    async (message: Handoff) => {
      if (message.status !== "editing") return;
      const contact = message.contact.trim();
      if (!isContactValid(contact)) {
        updateHandoff(message.id, { error: "이메일 주소를 다시 확인해 주세요." });
        return;
      }
      haptics.selection();
      updateHandoff(message.id, { status: "sending", error: null });
      try {
        // 사진은 로그인한 문의만 붙는다(서버 규칙). 하나라도 못 올리면 보내지 않고 알린다 — 학생이 사진을 빼거나 다시 보낸다.
        const auth = authRef.current;
        const token = auth && "accessToken" in auth ? auth.accessToken : null;
        const images = message.images ?? [];
        const imageKeys: string[] = [];
        if (images.length > 0) {
          if (!token) {
            updateHandoff(message.id, { status: "editing", error: "사진을 붙이려면 로그인해 주세요." });
            return;
          }
          for (const image of images) imageKeys.push(await uploadReportImage(image, token));
        }
        // POST 라 자동으로 다시 보내지 않는다(중복 접수 방지). 실패하면 학생이 다시 누른다.
        await submitFeedback(
          {
            content: handoffContent(message),
            contact: contact || undefined,
            imageKeys: imageKeys.length > 0 ? imageKeys : undefined,
            askRef: message.askRef ?? undefined,
          },
          token,
        );
        updateHandoff(message.id, { status: "sent" });
        haptics.success();
      } catch (error) {
        updateHandoff(message.id, { status: "editing", error: getErrorMessage(error, "보내지 못했어요. 잠시 뒤 다시 보내 주세요.") });
      }
    },
    [authRef, updateHandoff],
  );

  return { updateHandoff, addHandoffImages, sendHandoff };
}
