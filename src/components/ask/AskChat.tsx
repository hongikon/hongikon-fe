import { useCallback } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View, type ListRenderItem } from "react-native";
import { COLORS } from "../../constants/colors";
import ContentColumn from "../common/ContentColumn";
import type { ChatMessage } from "../../utils/ask/chatTypes";
import AskChatHeader from "./chat/AskChatHeader";
import { AskEmptyState, AskIntro, AskListFooter, JumpToBottomButton } from "./chat/ChatListParts";
import AskComposer from "./composer/AskComposer";
import MessageItem from "./messages/MessageItem";
import type { AskMapPlace } from './messages/types'
import { useAskChat } from '../../hooks/ask/useAskChat'
import { keyExtractor } from '../../utils/ask/askChat'

export interface AskChatProps {
  /** 있으면 머리에 뒤로 가기 버튼을 단다. */
  onClose?: () => void;
  /**
   * 서버 LLM 분류(/ask/route)에 보낼 /dev 암호키. 있으면 낱말로 못 찾은 질문과 앞 대화를 가리키는 질문을 서버에 묻는다.
   * 없으면(운영 앱) 지금처럼 앱 안의 낱말 찾기만 한다.
   */
  serverKey?: string;
  /** 앱 '물어보기' 탭(BETA): 로그인 토큰으로 서버에 묻는다. serverKey 가 있으면 그쪽이 먼저다. */
  accessToken?: string | null;
  /** 제목 옆 작은 BETA 표시(앱 탭). */
  beta?: boolean;
  /** 입력줄 아래 여백. 없으면 안전 영역 아래 값. 탭 화면은 떠 있는 탭 바 높이를 준다. */
  bottomInset?: number;
  /** 입력줄 위 한 줄(오늘 남은 질문 수 등). */
  composerNote?: string | null;
  /**
   * "지도에서 보기"(11-07, docs/ask-app-actions-plan.md). 있으면 위치가 있는 답에 버튼을 단다 — 앱 탭이 지도 탭으로 옮긴다.
   * 없으면(웹 /dev/ask, 지도와 떨어진 화면) 위치를 글로만 보인다.
   */
  onShowOnMap?: (place: AskMapPlace) => void;
  /** 답의 "여기서 가는 길"(11-09, 서버 'route' 조작). 없으면(길찾기 꺼짐·웹 미리보기) 버튼을 그리지 않는다. */
  onRouteTo?: (place: { target: string; from?: string }) => void;
  /** 설정 화면 열기(11-09 — '알림 설정 어떻게 해'). 없으면 열기 버튼 없이 안내만. */
  onOpenSettings?: (screen: "alerts" | "subscriptions") => void;
  /** 소식 탭 게시글 검색을 그 말로 열기(11-09 — '○○ 공지 찾아줘'). 없으면 버튼 없음. */
  onSearchNews?: (query: string) => void;
  /** 서버에 한 번 물은 뒤(성공·실패 모두) — 남은 수를 다시 받는다. */
  onAsked?: () => void;
}

/**
 * '물어보기' 챗봇 화면. 고객센터 챗봇처럼 묻고 답한다.
 * 완성 전까지는 운영 앱에 넣지 않고 웹 `/dev/ask`(암호키 인증, `DevPathGate`)에서만 연다(10-15 요청).
 * ① 안내 흐름(`ASK_FLOWS` — 학교 안내 페이지·운영진 확인)에 맞으면 필요한 것만 버튼으로 되물어 답하고 그 학교 페이지로 잇는다.
 * ② 흐름이 없으면 학교 홈페이지 부서 안내에서 그 일을 맡은 부서와 업무별 전화를 보여 준다.
 * 네트워크 없이 앱에 담아 둔 표만 훑는다 — 답을 지어내지 않고, 없으면 없다고 한다.
 * ③ serverKey 가 있으면(/dev/ask) 모든 질문을 서버에 묻는다. 서버는 앞 대화를 보고 필요한 안내를 골라 그 안내 원문 안에서만
 *    짧게 답한다(모르면 모른다고 하고 담당 부서를 안내). 답 아래 '근거 안내 보기'로 ①의 원문 안내를 펼친다.
 *    되묻기 단계면 ①처럼 버튼으로 되묻는다. 서버가 실패하면(꺼짐·한도·키·네트워크) ①·②로 돌아가지 않고 실패를 알린다(10-27).
 */
export default function AskChat({ onClose, serverKey, accessToken, beta = false, bottomInset, composerNote, onShowOnMap, onRouteTo, onOpenSettings, onSearchNews, onAsked }: AskChatProps) {
  const { insets, auth, appMode, composer, composerBottom, messages, scroll, ask, stopAsk, clearChat, pending, actions, env, canSend } = useAskChat({ serverKey, accessToken, bottomInset, onShowOnMap, onRouteTo, onOpenSettings, onSearchNews, onAsked })
  const renderMessage = useCallback<ListRenderItem<ChatMessage>>(
    ({ item }) => <MessageItem item={item} env={env} actions={actions} />,
    [env, actions],
  );

  // Android 도 padding(11-14 핫픽스): 물어보기는 모달이 아니라 탭 화면이라, edge-to-edge(Android 15·Expo 기본)에서는 키보드가 떠도
  // 창이 줄지 않아 입력칸이 키보드에 가렸다. KeyboardAvoidingView 는 키보드와 실제로 겹친 만큼만 띄우므로, 창이 줄어드는 기기에서도
  // 두 번 띄우지 않는다. 다른 입력 화면(모달)은 자기 창이 줄어 그대로 둔다.
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "web" ? undefined : "padding"}>
      <View style={[styles.container, appMode && styles.containerApp, { paddingTop: insets.top + (appMode ? 0 : 8) }]}>
        <ContentColumn>
          <AskChatHeader appMode={appMode} beta={beta} hasMessages={messages.length > 0} onBack={onClose} onClear={clearChat} />

          <View style={styles.flex}>
            <FlatList
              ref={scroll.listRef}
              style={styles.flex}
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderMessage}
              ListHeaderComponent={appMode ? null : <AskIntro appMode={appMode} />}
              // 대화가 없을 때 가운데 인사(Claude·ChatGPT 앱처럼). 웹 /dev/ask 는 예전처럼 안내 말풍선과 예시 버튼.
              ListEmptyComponent={appMode ? <AskEmptyState /> : null}
              ListFooterComponent={<AskListFooter appMode={appMode} pending={pending} hasAuth={!!auth} />}
              contentContainerStyle={[styles.list, appMode && styles.listApp, messages.length === 0 && styles.listEmpty]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onScroll={scroll.handleScroll}
              scrollEventThrottle={64}
              onContentSizeChange={scroll.handleContentSizeChange}
            />
            {scroll.showJump ? <JumpToBottomButton onPress={scroll.jumpToBottom} /> : null}
          </View>

          <AskComposer
            appMode={appMode}
            inputRef={composer.inputRef}
            input={composer.input}
            onChangeText={composer.setInput}
            latestInputRef={composer.latestInputRef}
            onSend={ask}
            stoppable={pending && !!auth}
            onStop={stopAsk}
            canSend={canSend}
            focused={composer.focused}
            onFocus={composer.onFocus}
            onBlur={composer.onBlur}
            bottom={composerBottom}
            note={composerNote}
          />
        </ContentColumn>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  containerApp: { backgroundColor: COLORS.white },
  listApp: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 18 },
  listEmpty: { flexGrow: 1 },
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 10 },
});
