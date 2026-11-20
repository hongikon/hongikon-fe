import type { ChatMessage, ChatMessageOf, NewMessage } from './chatTypes'
import { findNode } from './conversation'

/** 이 응답이 어느 답 기록인지 — 운영진 문의를 그 답에 잇는다. */
export function feedbackRef(message: ChatMessageOf<'feedback'>): string | null {
  return message.logId ? `route:${message.logId}` : message.flowRef && message.clientId ? `flow:${message.clientId}` : null
}

/**
 * '해결 안 됨' 뒤에 이을 것 — 운영진 문의 초안과, 바로 위 답의 담당 부서 전화(있으면).
 * 질문 글로 부서를 다시 찾으면 엉뚱한 곳이 걸려서('아이디는 뭘로?'의 '아이디'가 연구소 소개의 '아이디어'에 걸려
 * 미술디자인문화연구소가 나왔다, 10-15) 바로 위 답의 전화를 먼저 쓴다.
 */
export function handoffAfterFeedback(
  messages: readonly ChatMessage[],
  message: ChatMessageOf<'feedback'>,
): { handoff: NewMessage; phone: { label: string; phone: string } | undefined } {
  const answer = [...messages].reverse().find((item) => (item.role === 'answer' || item.role === 'reply') && item.id < message.id)
  const answerNode =
    answer?.role === 'answer'
      ? answer.node
      : answer?.role === 'reply' && answer.sources[0]
        ? findNode(answer.sources[0].flowId, answer.sources[0].nodeId)
        : undefined
  const phone = answerNode?.kind === 'answer' ? answerNode.phones?.[0] : undefined
  // 해결이 안 됐으면 운영진에게 이 대화를 넘길 수 있게 한다 — 챗봇에서 막혔을 때 다음 길이 없다는 게 가장 큰 불만이라(10-16 조사).
  const handoff: NewMessage = {
    role: 'handoff',
    question: message.question,
    answer: answer?.role === 'reply' ? answer.text : answer?.role === 'answer' ? answer.node.text : '',
    sources:
      answer?.role === 'reply'
        ? answer.sources.map((source) => `${source.flowId}/${source.nodeId}`)
        : answer?.role === 'answer'
          ? [`${answer.flowId}/${answer.nodeId}`]
          : [],
    note: '',
    contact: '',
    status: 'editing',
    error: null,
    images: [],
    askRef: feedbackRef(message),
  }
  return { handoff, phone }
}

/** 운영진에게 보낼 문의 글(1000자 안). 질문·홍익온 답(앞부분)·근거 안내 id·학생이 더 적은 말. */
export function handoffContent(message: Pick<ChatMessageOf<'handoff'>, 'answer' | 'question' | 'sources' | 'note'>): string {
  const answer = message.answer.replace(/\s+/g, ' ').trim()
  const lines = [
    '[물어보기에서 넘어온 문의]',
    `질문: ${message.question}`,
    answer ? `홍익온 답: ${answer.length > 350 ? `${answer.slice(0, 350)}…` : answer}` : null,
    message.sources.length ? `근거: ${message.sources.join(', ')}` : null,
    `더 알고 싶은 점: ${message.note.trim() || '(없음)'}`,
  ].filter((line): line is string => line !== null)
  return lines.join('\n').slice(0, 1000)
}

/** 답 받을 이메일 칸 — 비어 있거나 이메일 모양이면 통과. 앞뒤 공백은 뗀 값을 넘긴다. */
export function isContactValid(contact: string): boolean {
  return !contact || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)
}
