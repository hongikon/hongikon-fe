import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { routeAsk, streamAsk, type AskAuth, type AskRouteResult } from "../../apis/ask";
import type { useOptionalSettings } from "../../contexts/SettingsContext";
import * as haptics from "../../lib/haptics";
import { matchAskFlow } from "../../utils/officeAsk";
import { defaultGuides, isGreeting, type GreetingGuide } from "../../utils/askGreeting";
import { parseAskAppCommand } from "../../utils/askAppCommand";
import type { ChatMessageOf } from "../../utils/ask/chatTypes";
import { findStep, followUpMatch, randomId, recentTurns, stepMessages } from "../../utils/ask/conversation";
import { appendStep, askFailureText, stepInfo } from "../../utils/ask/streamStatus";
import { useLatestRef } from "./useLatestRef";
import type { ChatMessagesApi } from "./useChatMessages";

type Reply = ChatMessageOf<"reply">;

interface Options {
  chat: ChatMessagesApi;
  /** null 이면 서버에 묻지 않고 로그인·암호키 안내만. */
  auth: AskAuth | null;
  appMode: boolean;
  /** 설정 공급자 밖(웹 /dev/ask 미리보기)이면 null — 설정 명령을 알아듣지 않는다. */
  appSettings: ReturnType<typeof useOptionalSettings>;
  popularRef: MutableRefObject<GreetingGuide[]>;
  /** 물으면 입력칸을 비운다. */
  setInput: (text: string) => void;
  atBottomRef: MutableRefObject<boolean>;
  /** 서버에 한 번 물은 뒤(성공·실패 모두). */
  onAsked?: () => void;
}

/**
 * 질문 보내기와 서버 답 흘려받기. 인사·설정 명령은 앱이 바로 받고, 나머지는 서버에 묻는다.
 * 답 말풍선을 먼저 띄우고 서버가 하는 일·답 글자를 흘려받아 채운다. 흘려받기가 안 되면 한 번에 받기로.
 * 서버가 실패하면(꺼짐·한도·키·네트워크) 낱말 찾기로 돌아가지 않고 실패를 알린다(10-27).
 */
export function useAskStream({ chat, auth, appMode, appSettings, popularRef, setInput, atBottomRef, onAsked }: Options) {
  const { messages, setMessages, push, nextId } = chat;
  /** 서버에 묻는 중(입력을 막고 '찾고 있어요'를 보인다). */
  const [pending, setPending] = useState(false);
  const pendingRef = useLatestRef(pending);
  /** 지금 받고 있는 서버 답을 끊는 손잡이(멈춤 버튼). */
  const abortRef = useRef<AbortController | null>(null);
  /**
   * 이 화면(탭)의 대화 id — 서버 기록에서 같은 대화의 질문끼리만 잇는다. 사람·계정과는 잇지 않는 임의 값이고 저장하지 않는다
   * (새로 열면 새 대화).
   */
  const conversationId = useRef(randomId("c")).current;

  // 그릴 때마다 새로 만든다(원래처럼 그린 때의 대화·pending·auth 를 읽는다). 입력줄만 쓰고 memo 된 곳에 넘기지 않는다.
  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || pending) return;
    haptics.selection();
    setInput("");
    atBottomRef.current = true;
    if (isGreeting(question)) {
      // 인사만 왔으면 서버에 묻지 않는다(학교 안내에 걸릴 말이 없어 '못 찾았어요'가 나왔다, 11-07).
      const popular = popularRef.current;
      push(
        { role: "user", text: question },
        { role: "greeting", guides: popular.length > 0 ? popular : defaultGuides(), popular: popular.length > 0, chosen: null },
      );
      return;
    }
    const command = appSettings ? parseAskAppCommand(question) : null;
    if (command) {
      // 설정 바꾸기·화면 열기는 앱이 받는다 — 확인 버튼을 눌러야 바뀐다(docs/ask-app-actions-plan.md 2장).
      push({ role: "user", text: question }, { role: "command", command, done: null });
      return;
    }
    const matched = matchAskFlow(question) ?? followUpMatch(messages, question);
    const history = recentTurns(messages);
    push({ role: "user", text: question });
    if (!auth) {
      // 낱말 찾기로 답하지 않는다(10-27 운영진 요청) — 낱말만 겹치는 엉뚱한 안내나 긴 원문이 서버 답처럼 보였다.
      push({
        role: "text",
        text: appMode ? "로그인하면 물어볼 수 있어요." : "암호키가 없어 답할 수 없어요. /dev 화면에서 암호키를 넣고 다시 열어 주세요.",
      });
      return;
    }
    setPending(true);
    // 답 말풍선을 먼저 띄우고 서버가 하는 일·답 글자를 흘려받아 채운다. 답이 없으면(되묻기·none·실패) 지우고 아래로.
    const [liveId] = push({
      role: "reply",
      text: "",
      found: true,
      sources: [],
      links: [],
      buttons: null,
      appActions: [],
      question,
      streaming: true,
      stopped: false,
      logId: null,
      status: "질문을 이해하고 있어요",
      steps: ["질문 이해"],
      stepsOpen: false,
      sections: null,
      moreOpen: false,
    });
    const patchLive = (patch: (item: Reply) => Partial<Reply>) =>
      setMessages((prev) => prev.map((item) => (item.id === liveId && item.role === "reply" ? { ...item, ...patch(item) } : item)));
    const removeLive = () => setMessages((prev) => prev.filter((item) => item.id !== liveId));
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const hint = matched ? `${matched.flow.id}/${matched.nodeId}` : undefined;
      let heard = false;
      let result: AskRouteResult;
      try {
        result = await streamAsk(
          question.slice(0, 200),
          history,
          auth,
          hint,
          (event) => {
            heard = true;
            if (event.event === "delta") patchLive((item) => ({ text: item.text + event.data.text }));
            else if (event.event === "reset") patchLive(() => ({ text: "" }));
            else {
              const info = stepInfo(event);
              if (info) {
                // 같은 일이 잇따르면(공지를 여러 번 찾기 등) 과정에는 한 번만 남긴다.
                patchLive((item) => ({
                  status: info.status,
                  steps: appendStep(item.steps, info.step),
                }));
              }
            }
          },
          abort.signal,
          conversationId,
        );
      } catch (error) {
        // 흘려받기 자체가 안 되면(이벤트를 하나도 못 받음) 한 번에 받기로. 도중에 끊겼거나 학생이 멈췄으면 다시 묻지 않는다.
        if (heard || abort.signal.aborted) throw error;
        result = await routeAsk(question.slice(0, 200), history, auth, hint, abort.signal, conversationId);
      }
      const sources = (result.nodeIds.length > 0 ? result.nodeIds : [result.nodeId])
        .map(findStep)
        .filter((step): step is { flowId: string; nodeId: string } => step !== null);
      // 서버가 답을 썼으면 근거 안내가 없어도(지도 시설·공지만으로 답한 경우) 보인다.
      if (result.answer) {
        patchLive(() => ({
          text: result.answer ?? "",
          found: result.found !== false,
          sources,
          links: result.references ?? [],
          buttons: result.pages
            ? { pages: result.pages, phones: result.phones ?? [], facilityId: result.facilityId ?? null }
            : null,
          appActions: result.actions ?? [],
          streaming: false,
          logId: result.logId ?? null,
          sections: result.sections
            ? result.sections.map((section) => ({
                title: section.title,
                items: section.items,
                ordered: section.ordered,
                table: section.table ?? undefined,
              }))
            : null,
        }));
        push({ role: "feedback", question, resolved: null, logId: result.logId ?? null });
        return;
      }
      removeLive();
      const step = findStep(result.nodeId);
      if (step) {
        push(...stepMessages(step.flowId, step.nodeId, question, true, result.logId ?? null));
        return;
      }
      // 서버가 맞는 안내를 못 찾았다(none). 여기서 앱 낱말 찾기로 돌아가면 낱말만 겹치는 엉뚱한 안내가 나온다
      // ('K동 공동학습실' → '공동학습실' 낱말이 도서관 안내에 걸림, 10-16) — 못 찾았다고 하고 운영진에게 물어볼 길을 준다.
      push(
        { role: "text", text: "홍익온 안내에서 맞는 내용을 찾지 못했어요. 다른 말로 물어보거나 운영진에게 물어봐 주세요." },
        {
          role: "handoff",
          question,
          answer: "",
          sources: [],
          note: "",
          contact: "",
          status: "editing",
          error: null,
          images: [],
          askRef: result.logId ? `route:${result.logId}` : null,
        },
      );
      return;
    } catch (error) {
      if (abort.signal.aborted) {
        // 학생이 멈춤을 눌렀다 — 나온 글자가 있으면 그대로 두고 '중간에 멈춘 답'으로, 없으면 말풍선을 지우고 한 줄만.
        const stoppedId = nextId.current++;
        setMessages((prev) => {
          const live = prev.find((item) => item.id === liveId);
          if (live?.role === "reply" && live.text) {
            return prev.map((item) => (item.id === liveId && item.role === "reply" ? { ...item, streaming: false, stopped: true } : item));
          }
          return [...prev.filter((item) => item.id !== liveId), { id: stoppedId, role: "text", text: "요청을 멈췄어요." }];
        });
        return;
      }
      // 서버가 꺼졌거나(404·503) 한도(429)·키(403)·네트워크 오류. 낱말 찾기로 답하지 않고 실패를 그대로 알린다(10-27 운영진 요청 —
      // 실패할 때마다 낱말만 겹치는 안내·긴 원문이 서버 답처럼 나와, 답이 틀린 건지 서버가 실패한 건지 알 수 없었다).
      removeLive();
      push({ role: "text", text: askFailureText(error, appMode) });
    } finally {
      abortRef.current = null;
      setPending(false);
      onAsked?.();
    }
  };

  /** 답을 받는 동안 보내기 버튼이 멈춤으로 바뀐다. */
  const stopAsk = useCallback(() => {
    haptics.selection();
    abortRef.current?.abort();
  }, []);

  /** 받고 있는 답을 끊고 대화를 지운다(머리의 '초기화'). */
  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, [setMessages]);

  return { ask, stopAsk, clearChat, pending, pendingRef, conversationId };
}
