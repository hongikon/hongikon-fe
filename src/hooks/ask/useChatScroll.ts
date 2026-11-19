import { useCallback, useRef, useState } from "react";
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type { ChatMessage } from "../../utils/ask/chatTypes";

/**
 * 대화 목록 스크롤. 화면 맨 아래 근처에 있으면 새 글자가 올 때 따라 내린다. 위로 올려 읽는 중이면 그대로 두고 '맨 아래로' 버튼만 보인다.
 * atBottomRef 를 true 로 두면(새 질문·안내 칩) 다음 내용 변화에 맨 아래로 간다.
 */
export function useChatScroll() {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  /** 맨 아래 근처를 보고 있는지(새 글자가 오면 따라 내릴지). */
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const fromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      atBottomRef.current = fromBottom < 80;
      const show = fromBottom > 240;
      if (show !== showJump) setShowJump(show);
    },
    [showJump],
  );

  const jumpToBottom = useCallback(() => {
    atBottomRef.current = true;
    setShowJump(false);
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  // 새 말풍선이 그려진 뒤에 내려야 끝까지 간다(바로 부르면 늘어나기 전 높이에서 멈춰 답이 아래에 잘렸다).
  const handleContentSizeChange = useCallback(() => {
    if (atBottomRef.current) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  return { listRef, atBottomRef, showJump, handleScroll, jumpToBottom, handleContentSizeChange };
}
