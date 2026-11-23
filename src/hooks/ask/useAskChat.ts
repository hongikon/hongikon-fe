import { useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AskAuth } from '../../apis/ask'
import { useMapData } from '../../lib/mapData'
import { useOptionalSettings } from '../../contexts/SettingsContext'
import { useChatMessages } from './useChatMessages'
import { useKeyboardOpen } from './useKeyboardOpen'
import { usePopularGuides } from './usePopularGuides'
import { useChatScroll } from './useChatScroll'
import { useAskComposer } from './useAskComposer'
import { useAskStream } from './useAskStream'
import { useFlowChoices } from './useFlowChoices'
import { useAskFeedback } from './useAskFeedback'
import { useAskHandoff } from './useAskHandoff'
import { useAppCommand } from './useAppCommand'
import { useReplyToggles } from './useReplyToggles'
import { useLatestRef } from './useLatestRef'
import type { AskMessageActions, AskMessageEnv } from '../../components/ask/messages/types'
import type { AskChatProps } from '../../components/ask/AskChat'

/** AskChat 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useAskChat({ serverKey, accessToken, bottomInset, onShowOnMap, onRouteTo, onOpenSettings, onSearchNews, onAsked }: Pick<AskChatProps, 'serverKey' | 'accessToken' | 'bottomInset' | 'onShowOnMap' | 'onRouteTo' | 'onOpenSettings' | 'onSearchNews' | 'onAsked'>) {
  const insets = useSafeAreaInsets();
  const auth: AskAuth | null = serverKey ? { devKey: serverKey } : accessToken ? { accessToken } : null;
  const authRef = useLatestRef(auth);
  const appMode = !serverKey;
  const composer = useAskComposer();
  // 키보드가 올라오면 아래 탭 바 자리(bottomInset)만큼 띄우던 여백을 없앤다 — 입력칸이 키보드 바로 위에 붙게(11-11 운영진).
  const keyboardOpen = useKeyboardOpen({ skipWeb: true });
  const composerBottom = keyboardOpen ? 0 : (bottomInset ?? insets.bottom);
  const chat = useChatMessages();
  const { messages } = chat;
  // 설정 공급자 밖(웹 /dev/ask 미리보기)이면 설정 카드를 띄우지 않는다.
  const appSettings = useOptionalSettings();
  const appSettingsRef = useLatestRef(appSettings);
  const scroll = useChatScroll();
  const { facilities, buildings, partners } = useMapData();
  const facilitiesRef = useLatestRef(facilities);
  const popularRef = usePopularGuides();

  const { ask, stopAsk, clearChat, pending, pendingRef, conversationId } = useAskStream({
    chat,
    auth,
    appMode,
    appSettings,
    popularRef,
    setInput: composer.setInput,
    atBottomRef: scroll.atBottomRef,
    onAsked,
  });
  const { choose, chooseGuide, follow } = useFlowChoices({ chat, pendingRef, atBottomRef: scroll.atBottomRef });
  const { answerFeedback, chooseReason } = useAskFeedback({ chat, authRef, conversationId, facilitiesRef });
  const { updateHandoff, addHandoffImages, sendHandoff } = useAskHandoff({ setMessages: chat.setMessages, authRef });
  const applyCommand = useAppCommand({ appSettingsRef, setMessages: chat.setMessages });
  const toggleReply = useReplyToggles(chat.setMessages);

  // 말풍선에 넘기는 값은 같은 참조로 — 흘려받는 동안 글자가 바뀌는 답 한 줄만 다시 그린다.
  const actions = useMemo<AskMessageActions>(
    () => ({ choose, chooseGuide, follow, applyCommand, answerFeedback, chooseReason, updateHandoff, addHandoffImages, sendHandoff, toggleReply }),
    [choose, chooseGuide, follow, applyCommand, answerFeedback, chooseReason, updateHandoff, addHandoffImages, sendHandoff, toggleReply],
  );
  const canAttachImages = !!auth && "accessToken" in auth;
  const places = useMemo(() => ({ buildings, facilities, partners }), [buildings, facilities, partners]);
  const env = useMemo<AskMessageEnv>(
    () => ({ appMode, canAttachImages, places, onShowOnMap, onRouteTo, onOpenSettings, onSearchNews }),
    [appMode, canAttachImages, places, onShowOnMap, onRouteTo, onOpenSettings, onSearchNews],
  );

  const canSend = composer.input.trim().length > 0 && !pending;
  return {
    insets,
    auth,
    appMode,
    composer,
    composerBottom,
    messages,
    scroll,
    ask,
    stopAsk,
    clearChat,
    pending,
    actions,
    env,
    canSend,
  }
}
