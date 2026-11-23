import type { AskFeedbackReason } from "../../../apis/ask";
import type { GreetingGuide } from "../../../utils/ask/askGreeting";
import type { ChatMessageOf } from "../../../utils/ask/chatTypes";
import type { AskPlaceData } from "../../../utils/ask/places";

/** 지도에서 보기(11-07)에 넘기는 곳. */
export interface AskMapPlace {
  target: string;
  title?: string;
  summary?: string;
}

/**
 * 말풍선이 그리는 데 쓰는 화면 값. AskChat 이 useMemo 로 묶어 넘긴다 — 바뀔 때만 말풍선이 다시 그려진다.
 * 길찾기·지도·설정·소식 콜백은 없으면 그 버튼을 그리지 않는다(웹 /dev/ask).
 */
export interface AskMessageEnv {
  /** 앱 '물어보기' 탭(serverKey 없음). 웹 /dev/ask 는 예전 말풍선 모양. */
  appMode: boolean;
  /** 로그인 토큰으로 묻는다 — 운영진 문의에 사진을 붙일 수 있다. */
  canAttachImages: boolean;
  /** 지도 데이터(위치 줄·지도 버튼 이름). */
  places: AskPlaceData;
  onShowOnMap?: (place: AskMapPlace) => void;
  onRouteTo?: (place: { target: string; from?: string }) => void;
  onOpenSettings?: (screen: "alerts" | "subscriptions") => void;
  onSearchNews?: (query: string) => void;
}

/** 말풍선 안 버튼이 부르는 일. 모두 참조가 바뀌지 않는다(흘려받는 동안 다른 말풍선이 다시 그려지지 않게). */
export interface AskMessageActions {
  /** 되묻기 버튼 고르기. */
  choose: (message: ChatMessageOf<"question">, label: string, next: string) => void;
  /** 인사 뒤 안내 칩 고르기. */
  chooseGuide: (message: ChatMessageOf<"greeting">, guide: GreetingGuide) => void;
  /** 답 아래 '이어서 물어보기'. */
  follow: (message: ChatMessageOf<"answer">, label: string, next: string) => void;
  /** 설정 확인 카드의 버튼. */
  applyCommand: (message: ChatMessageOf<"command">, boardId?: string) => void;
  /** '해결됐나요' 응답. */
  answerFeedback: (message: ChatMessageOf<"feedback">, resolved: boolean) => void;
  /** '해결 안 됨'의 이유. */
  chooseReason: (message: ChatMessageOf<"feedback">, reason: AskFeedbackReason) => void;
  /** 운영진 문의 칸 고치기. */
  updateHandoff: (id: number, patch: Partial<ChatMessageOf<"handoff">>) => void;
  addHandoffImages: (message: ChatMessageOf<"handoff">) => void;
  sendHandoff: (message: ChatMessageOf<"handoff">) => void;
  /** 서버 답의 '연락처·링크 더 보기'(moreOpen)·'살펴본 과정'(stepsOpen) 펼치고 접기. */
  toggleReply: (id: number, key: "moreOpen" | "stepsOpen") => void;
}
