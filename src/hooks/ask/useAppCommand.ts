import { useCallback, type MutableRefObject } from "react";
import type { useOptionalSettings } from "../../contexts/SettingsContext";
import * as haptics from "../../lib/haptics";
import type { ChatMessage, ChatMessageOf } from "../../utils/ask/chatTypes";

/**
 * 설정 확인 카드의 버튼(11-09). 지금 값이 이미 원하는 값이면 바꾸지 않는다(토글이라 두 번 누르면 되돌아가지 않게).
 * 바꾼 뒤 카드에는 결과 한 줄만 남긴다. 설정은 ref 로 읽어 콜백 참조가 바뀌지 않는다.
 */
export function useAppCommand({
  appSettingsRef,
  setMessages,
}: {
  appSettingsRef: MutableRefObject<ReturnType<typeof useOptionalSettings>>;
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void;
}) {
  return useCallback(
    (message: ChatMessageOf<"command">, boardId?: string) => {
      const appSettings = appSettingsRef.current;
      if (message.done !== null || !appSettings) return;
      const { settings, toggleSubscribedDept, toggleDeptAlert, isDeptAlertOn, toggleSubscriptionAlert, toggleAlertCategory } = appSettings;
      const { command } = message;
      let done: string;
      if (command.kind === "subscribe" && boardId) {
        const name = command.boards.find((b) => b.id === boardId)?.name ?? boardId;
        const subscribed = settings.subscribedDepts.includes(boardId);
        if (subscribed !== command.on) toggleSubscribedDept(boardId);
        done = command.on ? `${name} 게시판을 구독했어요. 소식 탭에서 볼 수 있어요.` : `${name} 게시판 구독을 해제했어요.`;
      } else if (command.kind === "boardAlert" && boardId) {
        const name = command.boards.find((b) => b.id === boardId)?.name ?? boardId;
        if (!settings.subscribedDepts.includes(boardId)) {
          toggleSubscribedDept(boardId);
          done = `${name} 게시판을 구독했어요. 구독한 게시판은 알림이 켜져 있어요.`;
        } else {
          if (isDeptAlertOn(boardId) !== command.on) toggleDeptAlert(boardId);
          done = `${name} 게시판 알림을 ${command.on ? "켰어요" : "껐어요"}.`;
        }
      } else if (command.kind === "alertAll") {
        if (settings.subscriptionAlert !== command.on) toggleSubscriptionAlert();
        done = `알림을 ${command.on ? "켰어요" : "껐어요"}. 설정 탭 > 알림에서 언제든 바꿀 수 있어요.`;
      } else if (command.kind === "alertCategory") {
        if (settings.alertCategories.includes(command.category) !== command.on) toggleAlertCategory(command.category);
        done = `${command.category} 알림을 ${command.on ? "켰어요" : "껐어요"}.`;
      } else {
        return;
      }
      haptics.selection();
      setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, done } : item)));
    },
    [appSettingsRef, setMessages],
  );
}
