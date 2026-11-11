import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Linking,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/colors";
import { FONTS, TYPE } from "../../constants/typography";
import { RADIUS } from "../../constants/spacing";
import { ALL_ASK_FLOWS, askOffices, matchAskFlow, type OfficeAskResult } from "../../utils/officeAsk";
import { type AskAnswerNode, type AskLink, type AskQuestionNode, type AskSection } from "../../constants/askAnswers";
import {
  ASK_FEEDBACK_REASONS,
  getPopularGuides,
  routeAsk,
  sendAskFeedback,
  sendFlowFeedback,
  streamAsk,
  type AskAuth,
  type AskAction,
  type AskFeedbackReason,
  type AskRouteResult,
  type AskRouteTurn,
  type AskStreamEvent,
} from "../../apis/ask";
import { submitFeedback } from "../../apis/feedback";
import { pickAttachImages, ATTACH_MAX_IMAGES } from "../../utils/attachImages";
import { uploadReportImage, type PickedReportImage } from "../../apis/reports";
import { ApiError, getErrorMessage } from "../../apis/client";
import ContentColumn from "../common/ContentColumn";
import { formatFloor } from "../../utils/floors";
import ScreenHeader from "../common/ScreenHeader";
import { useMapData } from "../../lib/mapData";
import * as haptics from "../../lib/haptics";
import { defaultGuides, guidesFromIds, isGreeting, type GreetingGuide } from "../../utils/askGreeting";
import { newsSearchQuery, parseAskAppCommand, type AskAppCommand } from "../../utils/askAppCommand";
import { useOptionalSettings } from "../../contexts/SettingsContext";

/** 처음 열었을 때 눌러 볼 수 있는 질문. 모두 답이 있는 것만 둔다. */


/**
 * 대화 한 줄. 고객센터 챗봇처럼 봇이 버튼으로 되묻고(question), 고른 버튼은 사용자 말풍선으로 남는다.
 * 끝 답(answer) 뒤에는 '해결됐나요?'(feedback)를 붙이고, 아니라고 하면 맡은 부서(offices)를 이어 보여 준다.
 */
type ChatMessage =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "question"; node: AskQuestionNode; flowId: string; nodeId: string; chosen: string | null; viaServer: boolean }
  | {
      id: number;
      role: "answer";
      node: AskAnswerNode;
      flowId: string;
      nodeId: string;
      checkedAt: string;
      question: string;
      followed: boolean;
      viaServer: boolean;
    }
  | {
      id: number;
      role: "feedback";
      question: string;
      resolved: boolean | null;
      logId?: number | null;
      /** 앱 안내 흐름 답이면 그 흐름(서버 기록 logId 가 없을 때 /ask/feedback 으로 남긴다). */
      flowRef?: { flowId: string; nodeId: string } | null;
      /** 이 응답 한 번의 임의 값 — 이유를 고르며 다시 보내면 서버가 같은 행을 고친다. */
      clientId?: string;
      /** '해결 안 됨'의 이유(한 번 누름). */
      reason?: AskFeedbackReason | null;
    }
  | { id: number; role: "offices"; intro: string; offices: OfficeAskResult[] }
  /** 서버가 안내 원문 안에서만 쓴 답. sources 는 근거 안내('근거 안내 보기'로 원문을 펼친다). */
  | {
      id: number;
      role: "reply";
      text: string;
      found: boolean;
      sources: { flowId: string; nodeId: string }[];
      /** 근거로 쓴 학교 공지·학식 — 근거 목록에 링크로 붙는다. */
      links: { title: string; url: string | null; date: string | null }[];
      /** 서버가 정해 보낸 버튼(학교 페이지·전화·위치). null 이면 옛 서버 — 앱의 안내 데이터에서 찾는다. */
      buttons: { pages: { title: string; url: string }[]; phones: { label: string; phone: string }[]; facilityId: string | null } | null;
      /** 서버가 보낸 앱 조작 버튼(11-07, 지금은 'map'). 옛 서버면 빈 목록 — 위치는 buttons.facilityId·안내 데이터에서. */
      appActions: AskAction[];
      question: string;
      /** 서버가 아직 답을 만들고 있다(진행 단계와 답 글자가 실시간으로 바뀐다). */
      streaming: boolean;
      /** 지금 하는 일 한 줄(흘러나오는 동안 제자리에서 바뀐다). 쉬운 말만 — 안내 id·검색어·문장 조각은 보이지 않는다. */
      status: string;
      /** 학생이 멈춤을 눌러 중간에 끊긴 답. */
      stopped: boolean;
      /** 서버 기록 id('해결됐나요' 응답을 붙인다). */
      logId: number | null;
      /** 서버가 실제로 한 일(관련 안내 확인·공지 읽음·답 정리 …). 끝나면 '살펴본 과정'으로 접는다. */
      steps: string[];
      stepsOpen: boolean;
      /** 서버가 구조로 준 목록·표. null 이면(흘러나오는 중·옛 서버) text 를 잘라 그린다. */
      sections: AskSection[] | null;
      /** 접어 둔 연락처·링크 버튼을 펼쳤는지. */
      moreOpen: boolean;
    }
  | { id: number; role: "text"; text: string }
  /** 인사(하이·ㅎㅇ)에 앱이 바로 하는 답 — 요즘 많이 찾는 안내(없으면 기본 안내) 칩. 누르면 앱 안 안내를 연다(서버·한도 안 씀). */
  | { id: number; role: "greeting"; guides: GreetingGuide[]; popular: boolean; chosen: string | null }
  /**
   * 앱 설정 바꾸기·화면 열기(11-09 — '화학공학과 구독해줘', '알림 설정 어떻게 해'). 앱이 알아듣고(서버·한도 안 씀) 확인 버튼을 띄운다 —
   * 학생이 눌러야만 바뀐다. done: 누른 뒤 결과 한 줄.
   */
  | { id: number; role: "command"; command: AskAppCommand; done: string | null }
  /**
   * 해결이 안 됐을 때 운영진에게 넘기기(기존 문의하기 /feedback, 게스트). 보낼 내용(질문·홍익온 답·근거)을 미리 보여 주고,
   * 학생이 더 알고 싶은 점·답 받을 이메일(선택)을 적어 직접 보내기를 눌러야만 보낸다.
   */
  | {
      id: number;
      role: "handoff";
      question: string;
      answer: string;
      sources: string[];
      note: string;
      contact: string;
      status: "editing" | "sending" | "sent";
      error: string | null;
      /** 참고 사진(선택, 최대 3장, 로그인 필요). 보낼 때 올린다. */
      images?: PickedReportImage[];
      /** 이 문의가 나온 답 기록('route:123' / 'flow:{clientId}'). 관리자 '물어보기 피드백'에 붙는다. */
      askRef?: string | null;
    };

/** 지도 위 설명 카드에 쓸 첫 문장(마크다운 굵게 표시는 뗀다, 90자까지). */
function firstSentence(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const plain = text.replace(/\*\*/g, "").trim();
  const match = plain.match(/^[\s\S]*?(?:[.?!](?=\s|$)|\n)/);
  const first = (match ? match[0] : plain).trim();
  return first.length > 90 ? `${first.slice(0, 89).trimEnd()}…` : first || undefined;
}

type NewMessage = ChatMessage extends infer M ? (M extends { id: number } ? Omit<M, "id"> : never) : never;

interface AskChatProps {
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
  onShowOnMap?: (place: { target: string; title?: string; summary?: string }) => void;
  /** 답의 "여기서 가는 길"(11-09, 서버 'route' 조작). 없으면(길찾기 꺼짐·웹 미리보기) 버튼을 그리지 않는다. */
  onRouteTo?: (place: { target: string }) => void;
  /** 설정 화면 열기(11-09 — '알림 설정 어떻게 해'). 없으면 열기 버튼 없이 안내만. */
  onOpenSettings?: (screen: "alerts" | "subscriptions") => void;
  /** 소식 탭 게시글 검색을 그 말로 열기(11-09 — '○○ 공지 찾아줘'). 없으면 버튼 없음. */
  onSearchNews?: (query: string) => void;
  /** 서버에 한 번 물은 뒤(성공·실패 모두) — 남은 수를 다시 받는다. */
  onAsked?: () => void;
}

/**
 * 서버 답 없이 안내 원문을 그대로 보일 때의 상한. 학교 페이지를 통째로 옮긴 안내(교내장학금 등)는 수십 줄이고
 * 같은 소제목이 두 번 나오기도 해서(10-25 운영진 제보) 앞부분만 보이고 나머지는 아래 학교 페이지 버튼으로 넘긴다.
 */
/** 이어 묻는 말로 보는 짧은 질문(공백 뺀 글자 수)과 말투. */
const FOLLOW_UP_MAX = 20;
const FOLLOW_UP_WORDS = ["어떻게", "신청", "서류", "언제", "어디", "얼마", "방법", "기간", "그럼", "그거", "이거", "거기", "필요", "내야", "되나", "돼", "가능", "누가", "대상", "마감"];

const BRIEF_SECTIONS = 3;
const BRIEF_ITEMS = 4;
const BRIEF_TOTAL_ITEMS = 8;
const BRIEF_TABLE_ROWS = 8;

function briefSections(sections: readonly AskSection[] | undefined): { shown: AskSection[]; cut: boolean } {
  const shown: AskSection[] = [];
  const titles = new Set<string>();
  let total = 0;
  let cut = false;
  for (const section of sections ?? []) {
    // 운영진 정리(tips)는 이미 짧게 쓴 것이라 통째로 보이고, 학교 원문 줄 수에 세지 않는다.
    if (section.full) {
      shown.push(section);
      continue;
    }
    if (section.title && titles.has(section.title)) {
      cut = true;
      continue;
    }
    if (shown.filter((item) => !item.full).length >= BRIEF_SECTIONS || total >= BRIEF_TOTAL_ITEMS) {
      cut = true;
      break;
    }
    const room = Math.min(BRIEF_ITEMS, BRIEF_TOTAL_ITEMS - total);
    const items = section.items?.slice(0, room);
    const table = section.table ? { ...section.table, rows: section.table.rows.slice(0, BRIEF_TABLE_ROWS) } : undefined;
    if ((section.items?.length ?? 0) > room || (section.table?.rows.length ?? 0) > BRIEF_TABLE_ROWS) cut = true;
    total += items?.length ?? 0;
    titles.add(section.title);
    shown.push({ ...section, items, table });
  }
  return { shown, cut };
}

/** 서버 답이 실패했을 때 알릴 말. 상태 코드는 routeAsk(ApiError)에서만 알 수 있다 — 흘려받기 도중 끊기면 일반 문구. */
function askFailureText(error: unknown, app: boolean): string {
  const status = error instanceof ApiError ? error.status : null;
  // 앱 탭: 하루 한도·로그인 안내는 서버 문구를 그대로(계정 한도인지 전체 상한인지 서버만 안다).
  if (app && (status === 429 || status === 403) && error instanceof ApiError && error.serverMessage) return error.serverMessage;
  if (status === 429) return "질문이 많아 잠시 쉬고 있어요. 조금 뒤에 다시 물어봐 주세요.";
  if (status === 403) {
    return app ? "로그인하면 물어볼 수 있어요." : "암호키가 맞지 않아 답할 수 없어요. /dev 화면에서 암호키를 다시 넣어 주세요.";
  }
  if (status === 404) return "지금은 물어보기 서버가 꺼져 있어 답할 수 없어요.";
  return "지금은 답을 만들 수 없어요. 잠시 뒤에 다시 물어봐 주세요.";
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
  const insets = useSafeAreaInsets();
  const auth: AskAuth | null = serverKey ? { devKey: serverKey } : accessToken ? { accessToken } : null;
  const appMode = !serverKey;
  const [input, setInput] = useState("");
  // 웹 한글 입력 중 Enter 는 글자를 확정하는 키라 그 순간의 값이 아직 덜 들어와 있다 — 확정된 뒤 최신 값으로 보낸다.
  const latestInputRef = useRef("");
  latestInputRef.current = input;
  const [composerFocused, setComposerFocused] = useState(false);
  // 키보드가 올라오면 아래 탭 바 자리(bottomInset)만큼 띄우던 여백을 없앤다 — 입력칸이 키보드 바로 위에 붙게(11-11 운영진).
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const composerBottom = keyboardOpen ? 0 : (bottomInset ?? insets.bottom);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // 설정 공급자 밖(웹 /dev/ask 미리보기)이면 설정 카드를 띄우지 않는다.
  const appSettings = useOptionalSettings();
  /** 서버에 묻는 중(입력을 막고 '찾고 있어요'를 보인다). */
  const [pending, setPending] = useState(false);
  /** 지금 받고 있는 서버 답을 끊는 손잡이(멈춤 버튼). */
  const abortRef = useRef<AbortController | null>(null);
  /**
   * 이 화면(탭)의 대화 id — 서버 기록에서 같은 대화의 질문끼리만 잇는다. 사람·계정과는 잇지 않는 임의 값이고 저장하지 않는다
   * (새로 열면 새 대화).
   */
  const conversationId = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  ).current;
  const nextId = useRef(1);
  /** '해결됐나요' 응답 한 번의 임의 값(사람·기기와 잇지 않는다). */
  const newClientId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const listRef = useRef<FlatList<ChatMessage>>(null);
  /** 맨 아래 근처를 보고 있는지(새 글자가 오면 따라 내릴지). */
  const atBottomRef = useRef(true);
  // 앱 탭은 Claude·ChatGPT 앱처럼 — 답은 말풍선 없이 화면 폭 그대로, 내 질문만 오른쪽 남색 말풍선(11-01 브랜드색 강조).
  const botStyle = appMode ? [styles.botBubble, styles.botPlain] : styles.botBubble;
  const userStyle = appMode ? [styles.userBubble, styles.userApp] : styles.userBubble;
  const userTextStyle = appMode ? [styles.userText, styles.userTextApp] : styles.userText;
  const [showJump, setShowJump] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { facilities, buildings, partners } = useMapData();
  /** 요즘 많이 찾는 안내 — 탭을 열 때 한 번 받아 둔다(인사할 때 기다리지 않게). 못 받으면 빈 목록 → 기본 안내. */
  const popularRef = useRef<GreetingGuide[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    getPopularGuides(abort.signal).then((ids) => {
      if (!abort.signal.aborted) popularRef.current = guidesFromIds(ids);
    });
    return () => abort.abort();
  }, []);

  /** 말풍선을 잇고 붙인 id 를 돌려준다. id 는 상태 갱신 함수 밖에서 매긴다(개발 모드에서 갱신 함수가 두 번 돌아도 겹치지 않게). */
  const push = (...items: NewMessage[]) => {
    const added = items.map((item) => ({ ...item, id: nextId.current++ }) as ChatMessage);
    setMessages((prev) => [...prev, ...added]);
    return added.map((item) => item.id);
  };

  /**
   * 흘려받기 진행 이벤트 → 지금 하는 일 한 줄(status)과 '살펴본 과정' 한 줄(step). 쉬운 말만 쓴다 — 안내 id·검색어·안내 첫 문장 조각을
   * 그대로 보였더니 알아보기 힘들었다(10-16 사용자 지적). 사람이 읽을 수 있는 공지 제목·학식 날짜만 과정에 남긴다.
   */
  const stepInfo = (event: AskStreamEvent): { status: string; step: string | null } | null => {
    switch (event.event) {
      case "picked":
        return { status: "관련 문서를 읽고 있어요", step: `관련 안내 ${event.data.titles.length}개 확인` };
      case "search":
        return { status: "관련 문서를 더 찾고 있어요", step: "다른 안내 찾아봄" };
      case "read":
        return { status: "찾은 문서를 읽고 있어요", step: "안내 원문 읽음" };
      case "noticeSearch":
        return { status: "학교 공지를 찾고 있어요", step: "학교 공지 찾아봄" };
      case "noticeRead":
        return { status: "공지를 읽고 있어요", step: `공지 읽음 · ${event.data.title}` };
      case "cafeteria":
        return { status: "학식 메뉴를 확인하고 있어요", step: `학식 확인 · ${event.data.date}` };
      case "thinking":
        // 답 쓰기 호출부터 첫 글자까지 수 초(모델이 원문을 따지는 중) — 문구만 바꾸고 과정 줄은 늘리지 않는다(11-01).
        return { status: event.data.afterTools ? "찾은 내용으로 답을 준비하고 있어요" : "원문을 따져 보며 답을 준비하고 있어요", step: null };
      case "writing":
        return { status: "답을 정리하고 있어요", step: "답 정리" };
      default:
        return null;
    }
  };

  /** 흐름의 한 단계를 대화에 잇는다. 끝 답이면 '해결됐나요?'를 붙인다. */
  const stepMessages = (flowId: string, nodeId: string, question: string, viaServer = false, logId: number | null = null): NewMessage[] => {
    const flow = ALL_ASK_FLOWS.find((item) => item.id === flowId);
    const node = flow?.nodes[nodeId];
    if (!flow || !node) return [{ role: "text", text: "안내를 불러오지 못했어요. 다시 물어봐 주세요." }];
    if (node.kind === "question") return [{ role: "question", node, flowId, nodeId, chosen: null, viaServer }];
    return [
      { role: "answer", node, flowId, nodeId, checkedAt: flow.checkedAt, question, followed: false, viaServer },
      { role: "feedback", question, resolved: null, logId, flowRef: { flowId, nodeId }, clientId: newClientId() },
    ];
  };

  /** 서버에 넘길 앞 대화(최근 3턴) — 사용자 말, 그 뒤에 처음 열린 안내, 서버가 써 준 답. */
  const recentTurns = (): AskRouteTurn[] => {
    const turns: AskRouteTurn[] = [];
    for (const item of messages) {
      const last = turns[turns.length - 1];
      if (item.role === "user") turns.push({ question: item.text.slice(0, 200) });
      else if (last && !last.nodeId && (item.role === "question" || item.role === "answer")) {
        last.nodeId = `${item.flowId}/${item.nodeId}`;
      } else if (last && !last.answer && item.role === "reply") {
        if (!last.nodeId && item.sources[0]) last.nodeId = `${item.sources[0].flowId}/${item.sources[0].nodeId}`;
        last.answer = item.text.slice(0, 1000);
      }
    }
    return turns.slice(-3);
  };

  /**
   * 이어 묻는 말('어떻게 신청해?', '서류는?')은 낱말만으로 흐름을 못 찾는다 — 앞 질문과 합쳐 다시 찾고, 그래도 없으면 이어 묻는
   * 말투의 짧은 질문은 바로 앞에 본 안내로 간다(10-25 '학생포상 신청' 뒤 '어떻게 신청해?'가 엉뚱한 부서로 가던 것).
   * 서버 답이 없을 때(낱말 찾기)와 서버에 넘기는 후보(hint) 둘 다 이것을 쓴다.
   */
  const followUpMatch = (question: string): ReturnType<typeof matchAskFlow> => {
    let lastQuestion: string | null = null;
    let lastStep: { flowId: string; nodeId: string } | null = null;
    for (let i = messages.length - 1; i >= 0 && (!lastQuestion || !lastStep); i--) {
      const item = messages[i];
      if (item.role === "user") lastQuestion ??= item.text;
      else if (item.role === "answer" || item.role === "question") lastStep ??= { flowId: item.flowId, nodeId: item.nodeId };
      else if (item.role === "reply" && item.sources[0]) lastStep ??= item.sources[0];
    }
    if (lastQuestion) {
      const joined = matchAskFlow(`${lastQuestion} ${question}`);
      if (joined) return joined;
    }
    const flow = lastStep ? ALL_ASK_FLOWS.find((item) => item.id === lastStep.flowId) : undefined;
    const squashed = question.replace(/\s/g, "");
    if (flow && lastStep && flow.nodes[lastStep.nodeId] && squashed.length <= FOLLOW_UP_MAX && FOLLOW_UP_WORDS.some((word) => squashed.includes(word))) {
      return { flow, nodeId: lastStep.nodeId };
    }
    return null;
  };

  /** 서버가 고른 '흐름/단계' id 를 앱의 흐름에서 찾는다. 'none' 이거나 앱이 모르는 id(서버 목록이 더 새것)면 null. */
  const findStep = (id: string): { flowId: string; nodeId: string } | null => {
    const slash = id.indexOf("/");
    if (slash < 0) return null;
    const flowId = id.slice(0, slash);
    const nodeId = id.slice(slash + 1);
    return ALL_ASK_FLOWS.find((flow) => flow.id === flowId)?.nodes[nodeId] ? { flowId, nodeId } : null;
  };

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
    const matched = matchAskFlow(question) ?? followUpMatch(question);
    const history = recentTurns();
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
    const patchLive = (patch: (item: Extract<ChatMessage, { role: "reply" }>) => Partial<Extract<ChatMessage, { role: "reply" }>>) =>
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
                  steps: info.step === null || item.steps[item.steps.length - 1] === info.step ? item.steps : [...item.steps, info.step],
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
  const stopAsk = () => {
    haptics.selection();
    abortRef.current?.abort();
  };

  const choose = (message: Extract<ChatMessage, { role: "question" }>, label: string, next: string) => {
    if (message.chosen !== null) return;
    haptics.selection();
    // '해결 안 됨'일 때 부서를 찾을 수 있게 처음 질문 글을 넘긴다(버튼 글자로는 부서가 잘 안 걸린다).
    const lastQuestion = [...messages].reverse().find((item) => item.role === "user")?.text ?? label;
    setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, chosen: label } : item)));
    push({ role: "user", text: label }, ...stepMessages(message.flowId, next, lastQuestion));
  };

  /** 설정 확인 카드의 버튼. 지금 값이 이미 원하는 값이면 바꾸지 않는다(토글이라 두 번 누르면 되돌아가지 않게). */
  const applyCommand = (message: Extract<ChatMessage, { role: "command" }>, boardId?: string) => {
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
  };

  const commandText = (command: AskAppCommand): string => {
    switch (command.kind) {
      case "subscribe":
        if (command.on) {
          return command.boards.length > 1
            ? "어느 게시판을 구독할까요? 구독하면 소식 탭에 그 게시판 공지가 모이고 알림을 받을 수 있어요."
            : `${command.boards[0].name} 게시판을 구독할까요? 구독하면 소식 탭에 공지가 모이고 알림을 받을 수 있어요.`;
        }
        return command.boards.length > 1 ? "어느 게시판 구독을 해제할까요?" : `${command.boards[0].name} 게시판 구독을 해제할까요?`;
      case "boardAlert":
        return `${command.boards.map((b) => b.name).join(", ")} 게시판 알림을 ${command.on ? "켤" : "끌"}까요?`;
      case "alertAll":
        return command.on ? "앱 알림을 다시 켤까요?" : "앱 알림을 모두 끌까요? 끄면 구독한 게시판·분야 소식 알림이 오지 않아요.";
      case "alertCategory":
        return `${command.category} 분야 알림을 ${command.on ? "켤" : "끌"}까요?`;
      case "open":
        return command.screen === "alerts"
          ? "알림은 설정 탭 > 알림에서 바꿔요. 전체 알림, 분야별 알림(공지·장학·행사·수강·시설·취업·상담), 게시판별 알림, 제보 알림을 켜고 끌 수 있어요. 여기서 '장학 알림 꺼 줘'처럼 말해도 돼요."
          : "게시판 구독은 소식 탭이나 설정 탭 > 구독 관리에서 해요. 여기서 '화학공학과 구독해 줘'처럼 말해도 돼요.";
    }
  };

  const renderCommand = (item: Extract<ChatMessage, { role: "command" }>) => {
    const { command } = item;
    const button = (key: string, label: string, onPress: () => void) => (
      <TouchableOpacity key={key} style={styles.option} activeOpacity={0.7} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={styles.optionText}>{label}</Text>
      </TouchableOpacity>
    );
    let buttons: ReactNode[] = [];
    if (item.done === null) {
      if (command.kind === "subscribe" || command.kind === "boardAlert") {
        buttons = command.boards.map((board) => {
          const verb = command.kind === "subscribe" ? (command.on ? "구독하기" : "구독 해제") : command.on ? "알림 켜기" : "알림 끄기";
          return button(board.id, `${verb} · ${board.name}`, () => applyCommand(item, board.id));
        });
      } else if (command.kind === "alertAll" || command.kind === "alertCategory") {
        buttons = [button("apply", command.on ? "알림 켜기" : "알림 끄기", () => applyCommand(item))];
      }
    }
    if (command.kind === "open" && onOpenSettings) {
      const label = command.screen === "alerts" ? "알림 설정 열기" : "구독 관리 열기";
      buttons = [button("open", label, () => onOpenSettings(command.screen))];
    }
    return (
      <View style={botStyle}>
        <Text style={styles.botText}>{item.done ?? commandText(command)}</Text>
        {buttons.length > 0 ? <View style={styles.options}>{buttons}</View> : null}
      </View>
    );
  };

  const chooseGuide = (message: Extract<ChatMessage, { role: "greeting" }>, guide: GreetingGuide) => {
    if (message.chosen !== null || pending) return;
    haptics.selection();
    atBottomRef.current = true;
    setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, chosen: guide.label } : item)));
    push({ role: "user", text: guide.label }, ...stepMessages(guide.flowId, guide.nodeId, guide.label));
  };

  /**
   * 서버 답 아래 '출처' — 답에 실제로 쓴 안내를 학교 홈페이지 페이지로 묶어(같은 페이지는 한 줄) 실제 페이지 이름으로 보이고,
   * 근거로 쓴 공지·학식을 잇는다. 누르면 원문 페이지가 열린다. 안내 첫 문장을 제목으로 쓰거나 근거 원문을 대화에 펼치던 것은
   * 와닿지 않고 답이 연달아 나온 것처럼 보여 뺐다(10-16 사용자 지적).
   */
  const sourceLinks = (message: Extract<ChatMessage, { role: "reply" }>) => {
    const seen = new Set<string>();
    const out: { key: string; title: string; url: string | null; date: string | null; kind: "page" | "notice" | "menu" }[] = [];
    for (const source of message.sources) {
      const node = ALL_ASK_FLOWS.find((flow) => flow.id === source.flowId)?.nodes[source.nodeId];
      const link = node?.kind === "answer" ? node.links?.[0] : undefined;
      if (!link || seen.has(link.url)) continue;
      seen.add(link.url);
      out.push({ key: link.url, title: link.label, url: link.url, date: null, kind: "page" });
    }
    for (const link of message.links) {
      const key = link.url ?? link.title;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, title: link.title, url: link.url, date: link.date, kind: link.title.startsWith("학식 ") ? "menu" : "notice" });
    }
    return out;
  };

  /** 답 아래 '이어서 물어보기' 버튼. 한 번 누르면 그 답의 버튼은 접는다. */
  const follow = (message: Extract<ChatMessage, { role: "answer" }>, label: string, next: string) => {
    if (message.followed) return;
    haptics.selection();
    setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, followed: true } : item)));
    // 'course-table/start' 처럼 흐름 id 가 붙은 버튼은 다른 안내로 넘어간다(주제표 see).
    const slash = next.indexOf("/");
    const [flowId, nodeId] = slash < 0 ? [message.flowId, next] : [next.slice(0, slash), next.slice(slash + 1)];
    push({ role: "user", text: label }, ...stepMessages(flowId, nodeId, message.question));
  };

  const renderSection = (section: AskSection, key: string) => (
    <View key={key} style={appMode ? styles.sectionApp : styles.section}>
      {section.title ? <Text style={appMode ? styles.sectionTitleApp : styles.sectionTitle}>{section.title}</Text> : null}
      {section.table ? (
        <View style={styles.table}>
          {[section.table.head, ...section.table.rows].map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.tableRow, rowIndex === 0 && styles.tableHead]}>
              {row.map((cell, cellIndex) => {
                const ring = section.table?.colors?.[cellIndex];
                if (ring && cell) {
                  const color = COLORS.gradeTurn[ring];
                  return (
                    <View key={cellIndex} style={[styles.tableRingCell, cellIndex === 0 && styles.tableFirst]}>
                      <View style={[styles.tableRing, { borderColor: color }]}>
                        <Text style={[styles.tableRingText, { color }]}>{cell}</Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <Text
                    key={cellIndex}
                    style={[styles.tableCell, rowIndex === 0 && styles.tableHeadText, cellIndex === 0 && styles.tableFirst]}
                  >
                    {cell}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
      {section.items?.map((itemText, index) => (
        <View key={index} style={styles.itemRow}>
          <Text style={[styles.itemMark, section.ordered && styles.itemNumber]}>{section.ordered ? `${index + 1}` : "•"}</Text>
          <Text style={styles.itemText}>{itemLabel(itemText)}</Text>
        </View>
      ))}
    </View>
  );

  /** '라벨: 내용' 항목은 라벨을 굵게(서버 답이 '- 자격·조건: …'처럼 쓴다). */
  const itemLabel = (itemText: string) => {
    const match = itemText.match(/^([^:：\n]{1,16})[:：]\s+([\s\S]+)$/);
    return match ? (
      <>
        <Text style={styles.itemLabel}>{match[1]}: </Text>
        {match[2]}
      </>
    ) : (
      itemText
    );
  };

  /**
   * 서버 답 글을 안내 카드 모양으로 — 첫 단락은 요약, '[소제목]' 줄은 소제목, '- '·'1. ' 줄은 항목. 흘러나오는 도중에도 같은 모양으로 그린다.
   * 처음엔 글을 통째로 보여 줬더니 예전 안내 카드보다 읽기 힘들었다(10-16 사용자 지적).
   */
  const parseReply = (text: string): { lead: string; sections: AskSection[]; tail: string } => {
    const lead: string[] = [];
    const tail: string[] = [];
    const sections: { title: string; items: string[]; ordered?: boolean }[] = [];
    let current: { title: string; items: string[]; ordered?: boolean } | null = null;
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const heading = line.match(/^\[(.+)\]$/);
      if (heading) {
        tail.length = 0;
        current = { title: heading[1], items: [] };
        sections.push(current);
        continue;
      }
      const bullet = line.match(/^[-•·]\s+([\s\S]*)$/);
      const numbered = line.match(/^\d+[.)]\s+([\s\S]*)$/);
      if (bullet || numbered) {
        if (!current) {
          current = { title: "", items: [] };
          sections.push(current);
        }
        if (numbered && current.items.length === 0) current.ordered = true;
        current.items.push((bullet ?? numbered)![1]);
        continue;
      }
      // 소제목 뒤에 '- ' 없이 온 줄은 그 소제목의 항목이 아니라 카드 끝 문장('다친 곳을 알려 주시면 …' 같은 되묻기).
      if (current) tail.push(line);
      else lead.push(line);
    }
    return { lead: lead.join(" "), sections, tail: tail.join(" ") };
  };

  /** 서버 답 — 예전 안내 카드처럼 요약·소제목·항목, 그 아래 근거 안내의 위치·담당 전화·학교 페이지와 공지 버튼. */
  /** 답 아래 처음부터 보이는 전화·링크 버튼 수. 나머지는 '더 보기'로 접는다. */
  const VISIBLE_ACTIONS = 2;

  const renderReply = (item: Extract<ChatMessage, { role: "reply" }>) => {
    if (item.streaming && !item.text) {
      // Claude 앱처럼 지금 하는 일 한 줄만 제자리에서 바꿔 가며 깜빡인다(쌓지 않는다).
      return (
        <View style={botStyle}>
          <ThinkingLine text={item.status} />
        </View>
      );
    }
    // 서버가 목록·표를 구조로 줬으면 그대로 그린다(text 는 요약만). 옛 서버·흘러나오는 중이면 글을 잘라 그린다.
    const { lead, sections, tail } = item.sections ? { lead: item.text, sections: item.sections, tail: "" } : parseReply(item.text);
    const nodes = item.streaming
      ? []
      : item.sources
          .map((source) => ALL_ASK_FLOWS.find((flow) => flow.id === source.flowId)?.nodes[source.nodeId])
          .filter((node): node is AskAnswerNode => node?.kind === "answer");
    // 버튼은 서버가 보낸 것을 쓴다(링크 순서·전화를 서버만 고쳐 바꿀 수 있게). 옛 서버면 앱의 안내 데이터에서.
    const phones = item.buttons
      ? item.buttons.phones
      : nodes
          .flatMap((node) => node.phones ?? [])
          .filter((phone, index, all) => all.findIndex((other) => other.phone === phone.phone) === index)
          .slice(0, 3);
    const place = item.buttons ? item.buttons.facilityId : nodes.find((node) => node.facilityId)?.facilityId;
    const links = item.streaming
      ? []
      : item.buttons
        ? [
            ...item.buttons.pages.map((page) => ({ key: page.url, title: page.title, url: page.url as string | null, date: null as string | null })),
            ...item.links.filter((link) => link.url).map((link) => ({ key: link.url ?? link.title, title: link.title, url: link.url, date: link.date })),
          ]
        : sourceLinks(item).filter((source) => source.url);
    const cursor = item.streaming ? <Text style={styles.cursor}>▍</Text> : null;
    // 전화·학교 페이지·공지 버튼은 앞의 몇 개만 보이고 나머지는 접는다 — 한 답에 버튼이 줄줄이 붙어 답이 묻혔다(10-24 지적).
    const actions = [
      ...phones.map((phone) => renderPhone(phone.label, phone.phone, phone.phone)),
      ...links.map((source) =>
        renderLink({ label: source.date ? `${source.title} · ${source.date}` : source.title, url: source.url as string }, source.key),
      ),
    ];
    return (
      <View style={botStyle}>
        {lead ? (
          <Text style={[styles.botText, sections.length > 0 && styles.lead]}>
            {lead}
            {sections.length === 0 ? cursor : null}
          </Text>
        ) : null}
        {sections.map((section, index) => renderSection(section, `${index}`))}
        {tail ? <Text style={[styles.botText, styles.replyTail]}>{tail}</Text> : null}
        {sections.length > 0 ? cursor : null}
        {place ? renderPlace(place) : null}
        {item.streaming ? null : mapButtonFor(item, place ?? null)}
        {item.streaming ? null : routeButtonFor(item)}
        {item.streaming ? null : newsSearchButtonFor(item)}
        {actions.slice(0, VISIBLE_ACTIONS)}
        {actions.length > VISIBLE_ACTIONS ? (
          <>
            <TouchableOpacity
              style={styles.sourceToggle}
              activeOpacity={0.7}
              onPress={() =>
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === item.id && message.role === "reply" ? { ...message, moreOpen: !message.moreOpen } : message,
                  ),
                )
              }
              accessibilityRole="button"
              accessibilityState={{ expanded: item.moreOpen }}
              accessibilityLabel={`연락처·링크 ${actions.length - VISIBLE_ACTIONS}개 ${item.moreOpen ? "접기" : "더 보기"}`}
            >
              <Text style={styles.sourceToggleText}>연락처·링크 {actions.length - VISIBLE_ACTIONS}개 더 보기</Text>
              <Ionicons name={item.moreOpen ? "chevron-up" : "chevron-down"} size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {item.moreOpen ? actions.slice(VISIBLE_ACTIONS) : null}
          </>
        ) : null}
        {!item.streaming && item.steps.length > 1 ? (
          <>
            <TouchableOpacity
              style={styles.sourceToggle}
              activeOpacity={0.7}
              onPress={() =>
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === item.id && message.role === "reply" ? { ...message, stepsOpen: !message.stepsOpen } : message,
                  ),
                )
              }
              accessibilityRole="button"
              accessibilityState={{ expanded: item.stepsOpen }}
              accessibilityLabel={`살펴본 과정 ${item.steps.length}단계 ${item.stepsOpen ? "접기" : "보기"}`}
            >
              <Text style={styles.sourceToggleText}>살펴본 과정 {item.steps.length}단계</Text>
              <Ionicons name={item.stepsOpen ? "chevron-up" : "chevron-down"} size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {item.stepsOpen ? (
              <View style={styles.stepList}>
                {item.steps.map((step, index) => (
                  <View key={`${index}-${step}`} style={styles.stepRow}>
                    <Ionicons name="checkmark" size={13} color={COLORS.textTertiary} />
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
        {!item.streaming ? (
          <Text style={styles.checked}>
            {item.stopped
              ? "중간에 멈춘 답이에요"
              : item.found
                ? "학교 안내 원문에서 찾아 답했어요"
                : "안내에서 확인되지 않은 내용이 있어요 — 담당 부서에 확인해 주세요"}
          </Text>
        ) : null}
      </View>
    );
  };

  const answerFeedback = (message: Extract<ChatMessage, { role: "feedback" }>, resolved: boolean) => {
    if (message.resolved !== null) return;
    haptics.selection();
    setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, resolved } : item)));
    // 서버 답이면 그 기록에, 앱 안내 흐름 답이면 익명 기록에 응답을 남긴다(무엇이 해결 안 됐는지 알아야 고친다). 실패해도 화면은 그대로.
    reportFeedback(message, resolved);
    if (resolved) {
      push({ role: "text", text: "다행이에요. 다른 것도 궁금하면 언제든 물어보세요." });
      return;
    }
    // 바로 위 답에 담당 부서 전화가 있으면 그 부서로 안내한다. 질문 글로 부서를 다시 찾으면 엉뚱한 곳이 걸린다
    // ('아이디는 뭘로?'의 '아이디'가 연구소 소개의 '아이디어'에 걸려 미술디자인문화연구소가 나왔다, 10-15).
    const answer = [...messages].reverse().find((item) => (item.role === "answer" || item.role === "reply") && item.id < message.id);
    const answerNode =
      answer?.role === "answer"
        ? answer.node
        : answer?.role === "reply" && answer.sources[0]
          ? ALL_ASK_FLOWS.find((flow) => flow.id === answer.sources[0].flowId)?.nodes[answer.sources[0].nodeId]
          : undefined;
    const phone = answerNode?.kind === "answer" ? answerNode.phones?.[0] : undefined;
    // 해결이 안 됐으면 운영진에게 이 대화를 넘길 수 있게 한다 — 챗봇에서 막혔을 때 다음 길이 없다는 게 가장 큰 불만이라(10-16 조사).
    const handoff: NewMessage = {
      role: "handoff",
      question: message.question,
      answer: answer?.role === "reply" ? answer.text : answer?.role === "answer" ? answer.node.text : "",
      sources:
        answer?.role === "reply"
          ? answer.sources.map((source) => `${source.flowId}/${source.nodeId}`)
          : answer?.role === "answer"
            ? [`${answer.flowId}/${answer.nodeId}`]
            : [],
      note: "",
      contact: "",
      status: "editing",
      error: null,
      images: [],
      askRef: feedbackRef(message),
    };
    if (phone) {
      push({ role: "text", text: `위 안내의 담당 부서(${phone.label} ${phone.phone})에 물어보면 가장 정확해요.` }, handoff);
      return;
    }
    const offices = askOffices(facilities, message.question).slice(0, 3);
    push(
      offices.length > 0
        ? { role: "offices", intro: "담당 부서에 직접 물어보면 가장 정확해요.", offices }
        : { role: "text", text: "더 도와드리지 못해 아쉬워요. 위 학교 안내 페이지의 담당 부서로 문의해 보세요." },
      handoff,
    );
  };

  /** 이 응답이 어느 답 기록인지 — 운영진 문의를 그 답에 잇는다. */
  const feedbackRef = (message: Extract<ChatMessage, { role: "feedback" }>): string | null =>
    message.logId ? `route:${message.logId}` : message.flowRef && message.clientId ? `flow:${message.clientId}` : null;

  const reportFeedback = (message: Extract<ChatMessage, { role: "feedback" }>, resolved: boolean, reason?: AskFeedbackReason) => {
    if (message.logId && auth) {
      sendAskFeedback(message.logId, conversationId, resolved, auth, reason).catch(() => {});
    } else if (message.flowRef && message.clientId) {
      sendFlowFeedback({ question: message.question, ...message.flowRef, resolved, clientId: message.clientId, reason }).catch(() => {});
    }
  };

  /** '해결 안 됨' 뒤 이유 한 번 누르기. 한 번 고르면 바꾸지 않는다(버튼이 사라진다). */
  const chooseReason = (message: Extract<ChatMessage, { role: "feedback" }>, reason: AskFeedbackReason) => {
    if (message.resolved !== false || message.reason) return;
    haptics.selection();
    setMessages((prev) => prev.map((item) => (item.id === message.id && item.role === "feedback" ? { ...item, reason } : item)));
    reportFeedback(message, false, reason);
  };

  const renderReasons = (item: Extract<ChatMessage, { role: "feedback" }>) => {
    if (item.resolved !== false || (!item.logId && !item.flowRef)) return null;
    if (item.reason) {
      const label = ASK_FEEDBACK_REASONS.find((r) => r.code === item.reason)?.label;
      return <Text style={styles.reasonDone}>{label ? `'${label}' 알려 주셔서 고마워요. 운영진이 확인하고 고칠게요.` : null}</Text>;
    }
    return (
      <View style={styles.reasonBox}>
        <Text style={styles.reasonTitle}>어떤 점이 아쉬웠나요?</Text>
        <View style={styles.reasonRow}>
          {ASK_FEEDBACK_REASONS.map((r) => (
            <TouchableOpacity
              key={r.code}
              style={styles.reasonChip}
              activeOpacity={0.7}
              onPress={() => chooseReason(item, r.code)}
              accessibilityRole="button"
              accessibilityLabel={r.label}
            >
              <Text style={styles.reasonChipText}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const addHandoffImages = async (message: Extract<ChatMessage, { role: "handoff" }>) => {
    const current = message.images ?? [];
    const result = await pickAttachImages(current);
    if (result.images.length !== current.length || result.error) {
      updateHandoff(message.id, { images: result.images, error: result.error });
    }
  };

  const updateHandoff = (id: number, patch: Partial<Extract<ChatMessage, { role: "handoff" }>>) =>
    setMessages((prev) => prev.map((item) => (item.id === id && item.role === "handoff" ? { ...item, ...patch } : item)));

  /** 운영진에게 보낼 문의 글(1000자 안). 질문·홍익온 답(앞부분)·근거 안내 id·학생이 더 적은 말. */
  const handoffContent = (message: Extract<ChatMessage, { role: "handoff" }>) => {
    const answer = message.answer.replace(/\s+/g, " ").trim();
    const lines = [
      "[물어보기에서 넘어온 문의]",
      `질문: ${message.question}`,
      answer ? `홍익온 답: ${answer.length > 350 ? `${answer.slice(0, 350)}…` : answer}` : null,
      message.sources.length ? `근거: ${message.sources.join(", ")}` : null,
      `더 알고 싶은 점: ${message.note.trim() || "(없음)"}`,
    ].filter((line): line is string => line !== null);
    return lines.join("\n").slice(0, 1000);
  };

  const sendHandoff = async (message: Extract<ChatMessage, { role: "handoff" }>) => {
    if (message.status !== "editing") return;
    const contact = message.contact.trim();
    if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
      updateHandoff(message.id, { error: "이메일 주소를 다시 확인해 주세요." });
      return;
    }
    haptics.selection();
    updateHandoff(message.id, { status: "sending", error: null });
    try {
      // 사진은 로그인한 문의만 붙는다(서버 규칙). 하나라도 못 올리면 보내지 않고 알린다 — 학생이 사진을 빼거나 다시 보낸다.
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
  };

  const call = (phone: string) => {
    haptics.selection();
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() => {});
  };

  const openLink = (url: string) => {
    haptics.selection();
    Linking.openURL(url).catch(() => {});
  };

  const renderPhone = (label: string, phone: string, key: string) => (
    <View key={key} style={styles.contact}>
      <Text style={styles.duty} numberOfLines={3}>{label}</Text>
      <TouchableOpacity
        style={styles.phone}
        activeOpacity={0.7}
        onPress={() => call(phone)}
        accessibilityRole="button"
        accessibilityLabel={`${phone} 전화 걸기`}
        hitSlop={6}
      >
        <Ionicons name="call" size={13} color={COLORS.primary} />
        <Text style={styles.phoneText}>{phone}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLink = (link: AskLink, key: string) => (
    <TouchableOpacity
      key={key}
      style={appMode ? [styles.linkButton, styles.linkButtonApp] : styles.linkButton}
      activeOpacity={0.7}
      onPress={() => openLink(link.url)}
      accessibilityRole="link"
      accessibilityLabel={`${link.label} 열기`}
    >
      <Text style={styles.linkText} numberOfLines={1}>{link.label}</Text>
      <Ionicons name="open-outline" size={15} color={COLORS.primary} />
    </TouchableOpacity>
  );

  /** 찾아갈 부서 위치(건물·층). /dev/ask 는 지도와 떨어진 화면이라 글로만 보여 준다. 지도 데이터에 없으면 그리지 않는다. */
  const renderPlace = (facilityId: string) => {
    const facility = facilities.find((item) => item.id === facilityId);
    if (!facility) return null;
    const place = [facility.buildingName, facility.floor !== undefined ? formatFloor(facility.floor) : null].filter(Boolean).join(" ");
    return (
      <View style={styles.placeRow}>
        <Ionicons name="location" size={14} color={COLORS.primary} />
        <Text style={styles.placeText}>{[facility.note, place].filter(Boolean).join(" · ")}</Text>
      </View>
    );
  };

  /** 지도 대상 이름 — 앱 지도 데이터에 있는 곳만(없으면 버튼을 그리지 않는다). */
  const placeName = (target: string): string | null => {
    const split = target.indexOf(":");
    const kind = target.slice(0, split);
    const id = target.slice(split + 1);
    if (kind === "building") return buildings.find((b) => b.code === id)?.name ?? null;
    if (kind === "partner") return partners.find((p) => p.id === id)?.name ?? null;
    if (kind === "facility") {
      const facility = facilities.find((f) => f.id === id);
      return facility ? [facility.note, facility.buildingName].filter(Boolean).join(" · ") : null;
    }
    return null;
  };

  /** 답의 지도 버튼 — 서버가 보낸 'map' 조작이 먼저, 없으면(옛 서버·앱 안내) 근거 안내의 위치. */
  const mapButtonFor = (item: Extract<ChatMessage, { role: "reply" }>, place: string | null) => {
    const action = item.appActions.find((candidate) => candidate.type === "map");
    if (action) return renderMapButton(action, `map-${item.id}`);
    return place ? renderMapButton({ target: `facility:${place}`, summary: firstSentence(item.text) }, `map-${item.id}`) : null;
  };

  /** "여기서 가는 길" 버튼(11-09) — 서버가 'route' 조작을 보냈을 때만(가는 길을 물은 질문). 건물·시설만. */
  const routeButtonFor = (item: Extract<ChatMessage, { role: "reply" }>) => {
    const action = item.appActions.find((candidate) => candidate.type === "route");
    if (!action || !onRouteTo || !/^(building|facility):./.test(action.target)) return null;
    const name = placeName(action.target);
    if (!name) return null;
    const title = action.label || name;
    return (
      <TouchableOpacity
        key={`route-${item.id}`}
        style={styles.mapButton}
        activeOpacity={0.7}
        onPress={() => onRouteTo({ target: action.target })}
        accessibilityRole="button"
        accessibilityLabel={`내 위치에서 ${title} 가는 길`}
      >
        <Ionicons name="navigate-outline" size={15} color={COLORS.white} />
        <Text style={styles.mapButtonText} numberOfLines={1}>여기서 가는 길 · {title}</Text>
      </TouchableOpacity>
    );
  };

  /** '○○ 공지 찾아줘'(11-09)면 답 아래 "소식에서 검색" — 서버 답(공지 링크)에 더해 소식 탭에서 더 찾아볼 수 있게. */
  const newsSearchButtonFor = (item: Extract<ChatMessage, { role: "reply" }>) => {
    const query = onSearchNews ? newsSearchQuery(item.question) : null;
    if (!query || !onSearchNews) return null;
    return (
      <TouchableOpacity
        key={`news-${item.id}`}
        style={styles.mapButton}
        activeOpacity={0.7}
        onPress={() => onSearchNews(query)}
        accessibilityRole="button"
        accessibilityLabel={`소식에서 ${query} 검색`}
      >
        <Ionicons name="search-outline" size={15} color={COLORS.white} />
        <Text style={styles.mapButtonText} numberOfLines={1}>소식에서 검색 · {query}</Text>
      </TouchableOpacity>
    );
  };

  /** "지도에서 보기" 버튼(11-07). 누르면 지도 탭으로 옮겨 그 곳에 핀·시트, 위에 summary 카드. */
  const renderMapButton = (action: { target: string; label?: string | null; summary?: string | null }, key: string) => {
    if (!onShowOnMap) return null;
    const name = placeName(action.target);
    if (!name) return null;
    const title = action.label || name;
    return (
      <TouchableOpacity
        key={key}
        style={styles.mapButton}
        activeOpacity={0.7}
        onPress={() => onShowOnMap({ target: action.target, title, summary: action.summary ?? undefined })}
        accessibilityRole="button"
        accessibilityLabel={`${title} 지도에서 보기`}
      >
        <Ionicons name="map-outline" size={15} color={COLORS.white} />
        <Text style={styles.mapButtonText} numberOfLines={1}>지도에서 보기 · {title}</Text>
      </TouchableOpacity>
    );
  };

  const renderOffice = (office: OfficeAskResult) => (
    <View key={office.facility.id} style={styles.card}>
      <View style={styles.cardTitle}>
        <Text style={styles.name} numberOfLines={1}>{office.name}</Text>
        <Text style={styles.place} numberOfLines={1}>{office.place}</Text>
      </View>
      {office.contacts.map((contact, index) => renderPhone(contact.duty, contact.phone, `${contact.phone}-${index}`))}
      {office.snippet ? <Text style={styles.snippet} numberOfLines={3}>{office.snippet}</Text> : null}
      {renderLink({ label: "학교 홈페이지 · 부서 안내", url: office.source }, "source")}
    </View>
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    switch (item.role) {
      case "user":
        return (
          <View style={userStyle}>
            <Text style={userTextStyle}>{item.text}</Text>
          </View>
        );
      case "text":
        return (
          <View style={botStyle}>
            <Text style={styles.botText}>{item.text}</Text>
          </View>
        );
      case "handoff":
        return (
          <View style={botStyle}>
            <Text style={styles.handoffTitle}>운영진에게 물어보기</Text>
            {item.status === "sent" ? (
              <Text style={styles.botText}>
                운영진에게 보냈어요. 확인한 뒤{item.contact.trim() ? " 적어 주신 이메일로" : ""} 답변드릴게요.
              </Text>
            ) : (
              <>
                <Text style={styles.handoffDesc}>
                  아래 대화와 남기신 말을 운영진 문의함으로 보내요.{"\n"}이메일을 적으면 그 주소로 답을 드려요(선택).
                </Text>
                <View style={styles.handoffPreview}>
                  <Text style={styles.handoffPreviewText} numberOfLines={4}>
                    질문: {item.question}
                    {item.answer ? `\n홍익온 답: ${item.answer.replace(/\s+/g, " ")}` : ""}
                  </Text>
                </View>
                <TextInput
                  style={[styles.handoffInput, styles.handoffNote]}
                  value={item.note}
                  onChangeText={(note) => updateHandoff(item.id, { note, error: null })}
                  placeholder="더 알고 싶은 점을 적어 주세요"
                  placeholderTextColor={COLORS.textPlaceholder}
                  multiline
                  maxLength={400}
                  editable={item.status === "editing"}
                  accessibilityLabel="운영진에게 더 알고 싶은 점"
                />
                <TextInput
                  style={styles.handoffInput}
                  value={item.contact}
                  onChangeText={(contact) => updateHandoff(item.id, { contact, error: null })}
                  placeholder="답 받을 이메일 (선택)"
                  placeholderTextColor={COLORS.textPlaceholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={100}
                  editable={item.status === "editing"}
                  accessibilityLabel="답 받을 이메일"
                />
                {auth && "accessToken" in auth ? (
                  <View style={styles.attachRow}>
                    {(item.images ?? []).map((image) => (
                      <View key={image.uri} style={styles.attachThumbWrap}>
                        <Image source={{ uri: image.uri }} style={styles.attachThumb} accessibilityLabel="붙인 사진" />
                        {item.status === "editing" ? (
                          <TouchableOpacity
                            style={styles.attachRemove}
                            onPress={() => updateHandoff(item.id, { images: (item.images ?? []).filter((x) => x.uri !== image.uri), error: null })}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel="사진 빼기"
                          >
                            <Ionicons name="close" size={12} color={COLORS.white} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))}
                    {(item.images ?? []).length < ATTACH_MAX_IMAGES && item.status === "editing" ? (
                      <TouchableOpacity
                        style={styles.attachAdd}
                        activeOpacity={0.7}
                        onPress={() => addHandoffImages(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`사진 붙이기, ${(item.images ?? []).length}장 붙임, 최대 ${ATTACH_MAX_IMAGES}장`}
                      >
                        <Ionicons name="image-outline" size={18} color={COLORS.textSecondary} />
                        <Text style={styles.attachAddText}>사진 {(item.images ?? []).length}/{ATTACH_MAX_IMAGES}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
                {(item.images ?? []).length > 0 ? (
                  <Text style={styles.attachHint}>학번·전화번호처럼 개인정보가 보이면 가리고 붙여 주세요. 사진은 확인이 끝나면 지워요.</Text>
                ) : null}
                {item.error ? <Text style={styles.handoffError}>{item.error}</Text> : null}
                <TouchableOpacity
                  style={[styles.handoffSend, item.status === "sending" && styles.sendOff]}
                  activeOpacity={0.8}
                  disabled={item.status === "sending"}
                  onPress={() => sendHandoff(item)}
                  accessibilityRole="button"
                  accessibilityLabel="운영진에게 보내기"
                >
                  <Text style={styles.handoffSendText}>{item.status === "sending" ? "보내는 중이에요" : "보내기"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      case "reply":
        return renderReply(item);
      case "command":
        return renderCommand(item);
      case "greeting":
        return (
          <View style={botStyle}>
            <Text style={styles.botText}>안녕하세요! 학교에서 궁금한 걸 편하게 물어보세요.</Text>
            {item.chosen === null && item.guides.length > 0 ? (
              <>
                <Text style={styles.followTitle}>{item.popular ? "요즘 많이 찾는 안내" : "이런 걸 물어볼 수 있어요"}</Text>
                <View style={styles.examples}>
                  {item.guides.map((guide) => (
                    <TouchableOpacity
                      key={`${guide.flowId}/${guide.nodeId}`}
                      style={styles.example}
                      activeOpacity={0.7}
                      onPress={() => chooseGuide(item, guide)}
                      accessibilityRole="button"
                      accessibilityLabel={`${guide.label} 안내 보기`}
                    >
                      <Text style={styles.exampleText}>{guide.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        );
      case "question":
        return (
          <View style={botStyle}>
            <Text style={styles.botText}>{item.node.text}</Text>
            {item.chosen === null ? (
              <View style={styles.options}>
                {item.node.options.map((option) => (
                  <TouchableOpacity
                    key={option.next + option.label}
                    style={styles.option}
                    activeOpacity={0.7}
                    onPress={() => choose(item, option.label, option.next)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {item.viaServer ? <Text style={styles.checked}>질문 뜻을 풀어 찾은 안내예요</Text> : null}
          </View>
        );
      case "answer": {
        const brief = briefSections(item.node.sections);
        return (
          <View style={botStyle}>
            <Text style={[styles.botText, item.node.sections?.length ? styles.lead : null]}>{item.node.text}</Text>
            {brief.shown.map((section, index) => renderSection(section, `${index}`))}
            {brief.cut ? <Text style={styles.checked}>전체 내용은 아래 학교 페이지에서 볼 수 있어요.</Text> : null}
            {item.node.facilityId ? renderPlace(item.node.facilityId) : null}
            {item.node.facilityId ? renderMapButton({ target: `facility:${item.node.facilityId}`, summary: firstSentence(item.node.text) }, `map-${item.id}`) : null}
            {item.node.phones?.map((p) => renderPhone(p.label, p.phone, p.phone))}
            {item.node.followUps && !item.followed ? (
              <View style={styles.options}>
                <Text style={styles.followTitle}>이어서 물어보기</Text>
                {item.node.followUps.map((option) => (
                  <TouchableOpacity
                    key={option.next + option.label}
                    style={styles.option}
                    activeOpacity={0.7}
                    onPress={() => follow(item, option.label, option.next)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {item.node.links?.map((link) => renderLink(link, link.url))}
            <Text style={styles.checked}>
              {item.node.links?.length ? "학교 안내" : "운영진"} 확인 {item.checkedAt}
              {item.viaServer ? " · 질문 뜻을 풀어 찾은 안내예요" : ""}
            </Text>
          </View>
        );
      }
      case "feedback":
        if (appMode) {
          // Claude·ChatGPT 앱처럼 답 바로 아래 엄지 아이콘 두 개. 아래를 누르면 담당 부서·운영진 문의로 잇는다.
          return (
            <View>
            <View style={styles.feedbackIcons}>
              {item.resolved !== false ? (
                <TouchableOpacity
                  style={styles.feedbackIcon}
                  disabled={item.resolved !== null}
                  onPress={() => answerFeedback(item, true)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={item.resolved ? "도움이 됐어요(선택됨)" : "도움이 됐어요"}
                >
                  <Ionicons name={item.resolved ? "thumbs-up" : "thumbs-up-outline"} size={17} color={COLORS.textTertiary} />
                </TouchableOpacity>
              ) : null}
              {item.resolved !== true ? (
                <TouchableOpacity
                  style={styles.feedbackIcon}
                  disabled={item.resolved !== null}
                  onPress={() => answerFeedback(item, false)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={item.resolved === false ? "해결되지 않았어요(선택됨)" : "해결되지 않았어요"}
                >
                  <Ionicons name={item.resolved === false ? "thumbs-down" : "thumbs-down-outline"} size={17} color={COLORS.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </View>
            {renderReasons(item)}
            </View>
          );
        }
        return (
          <View style={botStyle}>
            <Text style={styles.botText}>궁금한 점이 해결됐나요?</Text>
            {item.resolved === null ? (
              <View style={styles.feedbackRow}>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  activeOpacity={0.7}
                  onPress={() => answerFeedback(item, true)}
                  accessibilityRole="button"
                  accessibilityLabel="네, 해결됐어요"
                >
                  <Text style={styles.feedbackText}>네, 해결됐어요</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  activeOpacity={0.7}
                  onPress={() => answerFeedback(item, false)}
                  accessibilityRole="button"
                  accessibilityLabel="아니요, 더 알고 싶어요"
                >
                  <Text style={styles.feedbackText}>아니요, 더 알고 싶어요</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.feedbackDone}>{item.resolved ? "네, 해결됐어요" : "아니요, 더 알고 싶어요"}</Text>
            )}
            {renderReasons(item)}
          </View>
        );
      case "offices":
        return (
          <View style={botStyle}>
            <Text style={styles.botText}>{item.intro}</Text>
            {item.offices.map(renderOffice)}
          </View>
        );
    }
  };

  const intro = (
    <View style={botStyle}>
      <Text style={styles.botText}>
        학교에서 해야 할 일을 물어보세요. 필요한 건 몇 가지 되물어서, 어떻게 하면 되는지와 어디에 연락하면 되는지 알려 드려요.
      </Text>
    </View>
  );

  const canSend = input.trim().length > 0 && !pending;

  /** 화면 맨 아래 근처에 있으면 새 글자가 올 때 따라 내린다. 위로 올려 읽는 중이면 그대로 두고 '맨 아래로' 버튼만 보인다. */
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const fromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    atBottomRef.current = fromBottom < 80;
    const show = fromBottom > 240;
    if (show !== showJump) setShowJump(show);
  };
  const jumpToBottom = () => {
    atBottomRef.current = true;
    setShowJump(false);
    listRef.current?.scrollToEnd({ animated: true });
  };

  // 대화가 없을 때 가운데 인사(Claude·ChatGPT 앱처럼). 웹 /dev/ask 는 예전처럼 안내 말풍선과 예시 버튼.
  const empty = appMode ? (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubble-ellipses" size={28} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>무엇이 궁금하세요?</Text>
      <Text style={styles.emptyDesc}>휴학·수강·장학·시설처럼 학교 일을 물으면{"\n"}학교 공식 안내를 찾아 답해요.</Text>
    </View>
  ) : null;

  return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.container, appMode && styles.containerApp, { paddingTop: insets.top + (appMode ? 0 : 8) }]}>
          <ContentColumn>
            <ScreenHeader
              title="물어보기"
              onBack={onClose}
              card={!appMode}
              border={false}
              children={
                beta ? (
                  <View style={styles.titleRow} accessibilityRole="header" accessibilityLabel="물어보기, 베타">
                    <Text style={styles.titleText}>물어보기</Text>
                    <Text style={styles.beta}>BETA</Text>
                  </View>
                ) : undefined
              }
              right={
                messages.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => {
                      abortRef.current?.abort();
                      setMessages([]);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="초기화 — 대화 지우기"
                    style={styles.clear}
                  >
                    <Text style={styles.clearText}>초기화</Text>
                  </TouchableOpacity>
                ) : appMode ? (
                  <View style={styles.clearSlot} />
                ) : undefined
              }
            />

            <View style={styles.flex}>
              <FlatList
                ref={listRef}
                style={styles.flex}
                data={messages}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderMessage}
                ListHeaderComponent={appMode ? null : intro}
                ListEmptyComponent={empty}
                ListFooterComponent={
                  <>
                    {pending && !auth ? (
                      <View style={[styles.botBubble, styles.pending]}>
                        <Text style={styles.botText}>안내를 찾아 답을 쓰고 있어요…</Text>
                      </View>
                    ) : null}
                    {appMode ? null : (
                      <Text style={styles.footnote}>
                        학교 홈페이지 안내와 운영진이 확인한 내용으로 답해요. 학교 공식 상담이 아니니 정확한 건 담당 부서에 확인해 주세요.
                        {auth
                          ? " 질문과 답은 답변 개선을 위해 기록돼요(1년 보관). 학번·연락처 같은 개인정보는 적지 말아 주세요."
                          : ""}
                      </Text>
                    )}
                  </>
                }
                contentContainerStyle={[styles.list, appMode && styles.listApp, messages.length === 0 && styles.listEmpty]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onScroll={handleScroll}
                scrollEventThrottle={64}
                // 새 말풍선이 그려진 뒤에 내려야 끝까지 간다(바로 부르면 늘어나기 전 높이에서 멈춰 답이 아래에 잘렸다).
                onContentSizeChange={() => {
                  if (atBottomRef.current) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
                }}
              />
              {showJump ? (
                <TouchableOpacity
                  style={styles.jump}
                  activeOpacity={0.8}
                  onPress={jumpToBottom}
                  accessibilityRole="button"
                  accessibilityLabel="맨 아래로"
                >
                  <Ionicons name="arrow-down" size={18} color={COLORS.textPrimary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {appMode ? (
              <View style={[styles.composerWrap, { paddingBottom: 6 + composerBottom }]}>
                {/* 안내 문구는 입력칸 위에(11-11 운영진 — 키보드가 올라와도 입력칸이 키보드 바로 위에 붙고 안내는 그 위에 보이게). */}
                <Text style={styles.disclaimer} numberOfLines={2}>
                  {composerNote ? `${composerNote} · ` : ""}AI 답변은 틀릴 수 있어요. 중요한 내용은 원문에서 확인하세요.
                </Text>
                <View style={[styles.composerBox, composerFocused && styles.composerBoxFocused]}>
                  <TextInput
                    ref={inputRef}
                    style={[styles.composerInput, WEB_NO_OUTLINE]}
                    value={input}
                    onChangeText={setInput}
                    placeholder="질문을 입력하세요"
                    placeholderTextColor={COLORS.textPlaceholder}
                    multiline
                    // 웹 여러 줄 칸은 기본 2줄 높이라 한 줄로 시작한다(앱은 minHeight 로 맞춤).
                    {...WEB_ONE_ROW}
                    maxLength={200}
                    returnKeyType="send"
                    onSubmitEditing={() => ask(input)}
                    submitBehavior="submit"
                    onFocus={() => setComposerFocused(true)}
                    onBlur={() => setComposerFocused(false)}
                    // 웹(react-native-web)은 여러 줄 칸에서 submitBehavior 를 보지 않아 Enter 가 줄바꿈이 됐다(11-09).
                    // Enter 는 보내기, Shift+Enter 는 줄바꿈. 한글 조합 중 Enter 는 글자가 확정된 뒤 보낸다.
                    onKeyPress={
                      Platform.OS === "web"
                        ? (event) => {
                            const native = event.nativeEvent as unknown as { key?: string; shiftKey?: boolean; isComposing?: boolean; keyCode?: number };
                            if (native.key !== "Enter" || native.shiftKey) return;
                            event.preventDefault();
                            // 조합 중이면 글자가 확정돼 칸에 들어간 뒤(다음 차례) 칸의 실제 값으로 보낸다.
                            const field = (event as unknown as { target?: { value?: string } }).target;
                            if (native.isComposing || native.keyCode === 229) setTimeout(() => ask(field?.value ?? latestInputRef.current), 0);
                            else ask(input);
                          }
                        : undefined
                    }
                    accessibilityLabel="학교 일 물어보기"
                  />
                  {pending && auth ? (
                    <TouchableOpacity
                      style={styles.composerSend}
                      onPress={stopAsk}
                      accessibilityRole="button"
                      accessibilityLabel="답 받기 멈추기"
                    >
                      <View style={styles.stopIcon} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.composerSend, !canSend && styles.composerSendOff]}
                      onPress={() => ask(input)}
                      disabled={!canSend}
                      accessibilityRole="button"
                      accessibilityLabel="보내기"
                    >
                      <Ionicons name="arrow-up" size={18} color={COLORS.white} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <>
                {composerNote ? <Text style={styles.composerNote}>{composerNote}</Text> : null}
                <View style={[styles.composer, { paddingBottom: 10 + composerBottom }]}>
                  <TextInput
                    ref={inputRef}
                    style={[styles.input, WEB_NO_OUTLINE]}
                    value={input}
                    onChangeText={setInput}
                    placeholder="예: 휴학 신청 기간"
                    placeholderTextColor={COLORS.textPlaceholder}
                    returnKeyType="send"
                    onSubmitEditing={() => ask(input)}
                    submitBehavior="submit"
                    accessibilityLabel="학교 일 물어보기"
                  />
                  {pending && auth ? (
                    <TouchableOpacity
                      style={styles.send}
                      onPress={stopAsk}
                      accessibilityRole="button"
                      accessibilityLabel="답 받기 멈추기"
                    >
                      <Ionicons name="stop" size={16} color={COLORS.white} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.send, !canSend && styles.sendOff]}
                      onPress={() => ask(input)}
                      disabled={!canSend}
                      accessibilityRole="button"
                      accessibilityLabel="보내기"
                    >
                      <Ionicons name="arrow-up" size={20} color={COLORS.white} />
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </ContentColumn>
        </View>
      </KeyboardAvoidingView>
  );
}

/** 서버가 지금 하는 일 한 줄. 글이 바뀌면 살짝 떠오르며 바뀌고, 그동안 은은하게 깜빡인다. */
/** 기다린 지 이만큼 지나면 경과 초를 붙인다 — 짧은 답에는 숫자가 깜빡이지 않게. */
const ELAPSED_AFTER_SECONDS = 3;

function ThinkingLine({ text }: { text: string }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(Date.now()).current;
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== "web" }).start();
  }, [text, enter]);
  return (
    <Animated.View
      style={[
        styles.thinkingRow,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
    >
      <Animated.View style={[styles.thinkingDot, { opacity: pulse }]} />
      <Animated.Text style={[styles.thinkingText, { opacity: pulse }]} numberOfLines={1}>
        {text}
      </Animated.Text>
      {seconds >= ELAPSED_AFTER_SECONDS ? (
        <Text style={styles.thinkingSeconds} accessibilityElementsHidden importantForAccessibility="no">
          {seconds}초
        </Text>
      ) : null}
    </Animated.View>
  );
}

/** 웹 입력칸의 브라우저 기본 포커스 테두리(분홍·파랑 바깥선)를 없앤다. 포커스는 입력 상자 테두리 색으로 보인다. */
/** react-native-web 여러 줄 칸(textarea)의 줄 수(rows). RN 타입에는 없어 따로 넘긴다. */
const WEB_ONE_ROW: object = Platform.OS === "web" ? { rows: 1 } : {};

const WEB_NO_OUTLINE = Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as unknown as TextStyle) : null;

const styles = StyleSheet.create({
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  titleText: { ...TYPE.headline, color: COLORS.textPrimary },
  beta: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  composerNote: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: "center", paddingTop: 6 },
  clearSlot: { width: 44 },
  containerApp: { backgroundColor: COLORS.white },
  botPlain: { maxWidth: "100%", alignSelf: "stretch", backgroundColor: "transparent", borderRadius: 0, padding: 0, gap: 12 },
  userApp: { maxWidth: "82%", backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingHorizontal: 16 },
  userTextApp: { fontSize: 16, lineHeight: 22, fontFamily: FONTS.regular, color: COLORS.white },
  sectionApp: { gap: 6, paddingTop: 2 },
  sectionTitleApp: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  listApp: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 18 },
  listEmpty: { flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40, gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySoft, marginBottom: 4 },
  emptyTitle: { fontSize: 24, lineHeight: 32, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: "center" },
  emptyDesc: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: "center" },
  jump: {
    position: "absolute",
    alignSelf: "center",
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  composerWrap: { paddingHorizontal: 12, paddingTop: 6, backgroundColor: COLORS.white, gap: 6 },
  composerBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  composerBoxFocused: { borderColor: COLORS.primary },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingTop: Platform.OS === "ios" ? 9 : 6,
    paddingBottom: Platform.OS === "ios" ? 9 : 6,
    fontSize: 16,
    lineHeight: 21,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  composerSend: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  composerSendOff: { backgroundColor: COLORS.toggleOff },
  stopIcon: { width: 12, height: 12, borderRadius: 2, backgroundColor: COLORS.white },
  disclaimer: { fontSize: 11, lineHeight: 15, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: "center" },
  feedbackIcons: { flexDirection: "row", gap: 4, marginTop: -10 },
  feedbackIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  clear: { paddingHorizontal: 6, paddingVertical: 4 },
  clearText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 10 },
  botBubble: {
    maxWidth: "92%",
    alignSelf: "flex-start",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderTopLeftRadius: 6,
    padding: 14,
    gap: 10,
  },
  botText: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  userBubble: {
    maxWidth: "80%",
    alignSelf: "flex-end",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    borderTopRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.medium, color: COLORS.white },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  example: {
    paddingHorizontal: 12,
    height: 34,
    justifyContent: "center",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  exampleText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  // 되묻는 버튼은 한 줄에 하나씩(고객센터 챗봇의 선택지 목록처럼) — 글이 길어도 잘리지 않게.
  options: { gap: 6 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.fill,
  },
  optionText: { flex: 1, fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  lead: { fontFamily: FONTS.semibold },
  section: { gap: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  sectionTitle: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.primary },
  itemRow: { flexDirection: "row", gap: 8 },
  itemMark: { width: 14, fontSize: 14, lineHeight: 21, fontFamily: FONTS.bold, color: COLORS.textTertiary, textAlign: "center" },
  itemNumber: { color: COLORS.primary },
  itemText: { flex: 1, fontSize: 14, lineHeight: 21, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  // 표는 말풍선 폭 안에서 칸을 고르게 나눈다(첫 칸만 조금 넓게). 좁은 화면에선 칸 안에서 줄을 바꾼다.
  table: { borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  tableHead: { borderTopWidth: 0, backgroundColor: COLORS.fill },
  tableCell: { flex: 1, paddingHorizontal: 6, paddingVertical: 7, fontSize: 12, lineHeight: 16, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  tableFirst: { flex: 1.3 },
  tableHeadText: { fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  tableRingCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 5, paddingHorizontal: 2 },
  tableRing: { minWidth: 26, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, borderWidth: 1.5, alignItems: "center" },
  tableRingText: { fontSize: 12, lineHeight: 16, fontFamily: FONTS.semibold },
  followTitle: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textTertiary, marginTop: 2 },
  card: { borderRadius: RADIUS.lg, backgroundColor: COLORS.fill, padding: 12, gap: 8 },
  cardTitle: { gap: 2 },
  name: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  place: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 2,
    maxWidth: "100%",
  },
  mapButtonText: { flexShrink: 1, fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.white },
  placeText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  contact: { flexDirection: "row", alignItems: "center", gap: 10 },
  duty: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  phone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  phoneText: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
  snippet: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  /** 앱 탭: 원문 링크도 전화 버튼처럼 옅은 브랜드색 바탕(테두리 없이). */
  linkButtonApp: { borderColor: COLORS.primarySoft, backgroundColor: COLORS.primarySoft },
  linkText: { flex: 1, fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
  checked: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  pending: { marginTop: 10 },
  stepList: { gap: 4 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepText: { flexShrink: 1, fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  itemLabel: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  replyTail: { marginTop: 12 },
  thinkingRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 22 },
  thinkingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  thinkingSeconds: { fontSize: 13, lineHeight: 20, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  thinkingText: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontFamily: FONTS.medium, color: COLORS.primary },
  cursor: { color: COLORS.primary },
  handoffTitle: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 4 },
  handoffDesc: { fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  handoffPreview: { marginTop: 8, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.background },
  handoffPreviewText: { fontSize: 12, lineHeight: 18, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  handoffInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  handoffNote: { minHeight: 72, textAlignVertical: "top" },
  reasonBox: { marginTop: 6 },
  reasonTitle: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary, marginBottom: 6 },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reasonChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: COLORS.white,
  },
  reasonChipText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  reasonDone: { marginTop: 6, fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  attachRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  attachThumbWrap: { width: 56, height: 56 },
  attachThumb: { width: 56, height: 56, borderRadius: RADIUS.md, backgroundColor: COLORS.background },
  attachRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.textPrimary,
  },
  attachAdd: {
    height: 56,
    minWidth: 56,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  attachAddText: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  attachHint: { marginTop: 6, fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  handoffError: { marginTop: 6, fontSize: 12, fontFamily: FONTS.regular, color: COLORS.danger },
  handoffSend: { marginTop: 10, borderRadius: RADIUS.md, paddingVertical: 11, alignItems: "center", backgroundColor: COLORS.primary },
  handoffSendText: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.white },
  sourceToggle: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 10, paddingVertical: 4 },
  sourceToggleText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  feedbackRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  feedbackButton: {
    paddingHorizontal: 12,
    height: 36,
    justifyContent: "center",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  feedbackText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  feedbackDone: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textTertiary },
  footnote: { marginTop: 6, fontSize: 11, lineHeight: 16, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { backgroundColor: COLORS.toggleOff },
});
