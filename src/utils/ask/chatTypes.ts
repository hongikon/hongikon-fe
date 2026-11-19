import type { AskAnswerNode, AskQuestionNode, AskSection } from '../../constants/askAnswers'
import type { AskAction, AskFeedbackReason } from '../../apis/ask'
import type { PickedReportImage } from '../../apis/reports'
import type { OfficeAskResult } from '../officeAsk'
import type { GreetingGuide } from '../askGreeting'
import type { AskAppCommand } from '../askAppCommand'

/**
 * 대화 한 줄. 고객센터 챗봇처럼 봇이 버튼으로 되묻고(question), 고른 버튼은 사용자 말풍선으로 남는다.
 * 끝 답(answer) 뒤에는 '해결됐나요?'(feedback)를 붙이고, 아니라고 하면 맡은 부서(offices)를 이어 보여 준다.
 */
export type ChatMessage =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'question'; node: AskQuestionNode; flowId: string; nodeId: string; chosen: string | null; viaServer: boolean }
  | {
      id: number
      role: 'answer'
      node: AskAnswerNode
      flowId: string
      nodeId: string
      checkedAt: string
      question: string
      followed: boolean
      viaServer: boolean
    }
  | {
      id: number
      role: 'feedback'
      question: string
      resolved: boolean | null
      logId?: number | null
      /** 앱 안내 흐름 답이면 그 흐름(서버 기록 logId 가 없을 때 /ask/feedback 으로 남긴다). */
      flowRef?: { flowId: string; nodeId: string } | null
      /** 이 응답 한 번의 임의 값 — 이유를 고르며 다시 보내면 서버가 같은 행을 고친다. */
      clientId?: string
      /** '해결 안 됨'의 이유(한 번 누름). */
      reason?: AskFeedbackReason | null
    }
  | { id: number; role: 'offices'; intro: string; offices: OfficeAskResult[] }
  /** 서버가 안내 원문 안에서만 쓴 답. sources 는 근거 안내('근거 안내 보기'로 원문을 펼친다). */
  | {
      id: number
      role: 'reply'
      text: string
      found: boolean
      sources: { flowId: string; nodeId: string }[]
      /** 근거로 쓴 학교 공지·학식 — 근거 목록에 링크로 붙는다. */
      links: { title: string; url: string | null; date: string | null }[]
      /** 서버가 정해 보낸 버튼(학교 페이지·전화·위치). null 이면 옛 서버 — 앱의 안내 데이터에서 찾는다. */
      buttons: { pages: { title: string; url: string }[]; phones: { label: string; phone: string }[]; facilityId: string | null } | null
      /** 서버가 보낸 앱 조작 버튼(11-07, 지금은 'map'). 옛 서버면 빈 목록 — 위치는 buttons.facilityId·안내 데이터에서. */
      appActions: AskAction[]
      question: string
      /** 서버가 아직 답을 만들고 있다(진행 단계와 답 글자가 실시간으로 바뀐다). */
      streaming: boolean
      /** 지금 하는 일 한 줄(흘러나오는 동안 제자리에서 바뀐다). 쉬운 말만 — 안내 id·검색어·문장 조각은 보이지 않는다. */
      status: string
      /** 학생이 멈춤을 눌러 중간에 끊긴 답. */
      stopped: boolean
      /** 서버 기록 id('해결됐나요' 응답을 붙인다). */
      logId: number | null
      /** 서버가 실제로 한 일(관련 안내 확인·공지 읽음·답 정리 …). 끝나면 '살펴본 과정'으로 접는다. */
      steps: string[]
      stepsOpen: boolean
      /** 서버가 구조로 준 목록·표. null 이면(흘러나오는 중·옛 서버) text 를 잘라 그린다. */
      sections: AskSection[] | null
      /** 접어 둔 연락처·링크 버튼을 펼쳤는지. */
      moreOpen: boolean
    }
  | { id: number; role: 'text'; text: string }
  /** 인사(하이·ㅎㅇ)에 앱이 바로 하는 답 — 요즘 많이 찾는 안내(없으면 기본 안내) 칩. 누르면 앱 안 안내를 연다(서버·한도 안 씀). */
  | { id: number; role: 'greeting'; guides: GreetingGuide[]; popular: boolean; chosen: string | null }
  /**
   * 앱 설정 바꾸기·화면 열기(11-09 — '화학공학과 구독해줘', '알림 설정 어떻게 해'). 앱이 알아듣고(서버·한도 안 씀) 확인 버튼을 띄운다 —
   * 학생이 눌러야만 바뀐다. done: 누른 뒤 결과 한 줄.
   */
  | { id: number; role: 'command'; command: AskAppCommand; done: string | null }
  /**
   * 해결이 안 됐을 때 운영진에게 넘기기(기존 문의하기 /feedback, 게스트). 보낼 내용(질문·홍익온 답·근거)을 미리 보여 주고,
   * 학생이 더 알고 싶은 점·답 받을 이메일(선택)을 적어 직접 보내기를 눌러야만 보낸다.
   */
  | {
      id: number
      role: 'handoff'
      question: string
      answer: string
      sources: string[]
      note: string
      contact: string
      status: 'editing' | 'sending' | 'sent'
      error: string | null
      /** 참고 사진(선택, 최대 3장, 로그인 필요). 보낼 때 올린다. */
      images?: PickedReportImage[]
      /** 이 문의가 나온 답 기록('route:123' / 'flow:{clientId}'). 관리자 '물어보기 피드백'에 붙는다. */
      askRef?: string | null
    }

/** 역할별 대화 한 줄. */
export type ChatMessageOf<R extends ChatMessage['role']> = Extract<ChatMessage, { role: R }>

/** id 를 붙이기 전의 대화 한 줄(push 에 넘긴다). */
export type NewMessage = ChatMessage extends infer M ? (M extends { id: number } ? Omit<M, 'id'> : never) : never

/** 흐름의 한 단계 위치. */
export interface FlowStep {
  flowId: string
  nodeId: string
}
