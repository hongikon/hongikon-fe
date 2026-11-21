import type { AskAnswerNode } from '../../constants/askAnswers'
import type { AskRouteTurn } from '../../apis/ask'
import { ALL_ASK_FLOWS, matchAskFlow } from './officeAsk'
import type { ChatMessage, ChatMessageOf, FlowStep, NewMessage } from './chatTypes'

/** 이어 묻는 말로 보는 짧은 질문(공백 뺀 글자 수)과 말투. */
const FOLLOW_UP_MAX = 20
const FOLLOW_UP_WORDS = ['어떻게', '신청', '서류', '언제', '어디', '얼마', '방법', '기간', '그럼', '그거', '이거', '거기', '필요', '내야', '되나', '돼', '가능', '누가', '대상', '마감']

/** 사람·기기와 잇지 않는 임의 값(대화 id·'해결됐나요' 응답 id). crypto.randomUUID 가 없으면 시각+난수. */
export function randomId(prefix: string): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 흐름의 한 단계(앱 안내 데이터). 없으면 undefined. */
export function findNode(flowId: string, nodeId: string) {
  return ALL_ASK_FLOWS.find((flow) => flow.id === flowId)?.nodes[nodeId]
}

/** 흐름의 한 단계를 대화에 잇는다. 끝 답이면 '해결됐나요?'를 붙인다. */
export function stepMessages(flowId: string, nodeId: string, question: string, viaServer = false, logId: number | null = null): NewMessage[] {
  const flow = ALL_ASK_FLOWS.find((item) => item.id === flowId)
  const node = flow?.nodes[nodeId]
  if (!flow || !node) return [{ role: 'text', text: '안내를 불러오지 못했어요. 다시 물어봐 주세요.' }]
  if (node.kind === 'question') return [{ role: 'question', node, flowId, nodeId, chosen: null, viaServer }]
  return [
    { role: 'answer', node, flowId, nodeId, checkedAt: flow.checkedAt, question, followed: false, viaServer },
    { role: 'feedback', question, resolved: null, logId, flowRef: { flowId, nodeId }, clientId: randomId('f') },
  ]
}

/** 서버에 넘길 앞 대화(최근 3턴) — 사용자 말, 그 뒤에 처음 열린 안내, 서버가 써 준 답. */
export function recentTurns(messages: readonly ChatMessage[]): AskRouteTurn[] {
  const turns: AskRouteTurn[] = []
  for (const item of messages) {
    const last = turns[turns.length - 1]
    if (item.role === 'user') turns.push({ question: item.text.slice(0, 200) })
    else if (last && !last.nodeId && (item.role === 'question' || item.role === 'answer')) {
      last.nodeId = `${item.flowId}/${item.nodeId}`
    } else if (last && !last.answer && item.role === 'reply') {
      if (!last.nodeId && item.sources[0]) last.nodeId = `${item.sources[0].flowId}/${item.sources[0].nodeId}`
      last.answer = item.text.slice(0, 1000)
    }
  }
  return turns.slice(-3)
}

/**
 * 이어 묻는 말('어떻게 신청해?', '서류는?')은 낱말만으로 흐름을 못 찾는다 — 앞 질문과 합쳐 다시 찾고, 그래도 없으면 이어 묻는
 * 말투의 짧은 질문은 바로 앞에 본 안내로 간다(10-25 '학생포상 신청' 뒤 '어떻게 신청해?'가 엉뚱한 부서로 가던 것).
 * 서버 답이 없을 때(낱말 찾기)와 서버에 넘기는 후보(hint) 둘 다 이것을 쓴다.
 */
export function followUpMatch(messages: readonly ChatMessage[], question: string): ReturnType<typeof matchAskFlow> {
  let lastQuestion: string | null = null
  let lastStep: FlowStep | null = null
  for (let i = messages.length - 1; i >= 0 && (!lastQuestion || !lastStep); i--) {
    const item = messages[i]
    if (item.role === 'user') lastQuestion ??= item.text
    else if (item.role === 'answer' || item.role === 'question') lastStep ??= { flowId: item.flowId, nodeId: item.nodeId }
    else if (item.role === 'reply' && item.sources[0]) lastStep ??= item.sources[0]
  }
  if (lastQuestion) {
    const joined = matchAskFlow(`${lastQuestion} ${question}`)
    if (joined) return joined
  }
  const flow = lastStep ? ALL_ASK_FLOWS.find((item) => item.id === lastStep.flowId) : undefined
  const squashed = question.replace(/\s/g, '')
  if (flow && lastStep && flow.nodes[lastStep.nodeId] && squashed.length <= FOLLOW_UP_MAX && FOLLOW_UP_WORDS.some((word) => squashed.includes(word))) {
    return { flow, nodeId: lastStep.nodeId }
  }
  return null
}

/** 서버가 고른 '흐름/단계' id 를 앱의 흐름에서 찾는다. 'none' 이거나 앱이 모르는 id(서버 목록이 더 새것)면 null. */
export function findStep(id: string): FlowStep | null {
  const slash = id.indexOf('/')
  if (slash < 0) return null
  const flowId = id.slice(0, slash)
  const nodeId = id.slice(slash + 1)
  return ALL_ASK_FLOWS.find((flow) => flow.id === flowId)?.nodes[nodeId] ? { flowId, nodeId } : null
}

/** '이어서 물어보기' 버튼이 갈 단계. 'course-table/start' 처럼 흐름 id 가 붙은 버튼은 다른 안내로 넘어간다(주제표 see). */
export function followTarget(currentFlowId: string, next: string): FlowStep {
  const slash = next.indexOf('/')
  const [flowId, nodeId] = slash < 0 ? [currentFlowId, next] : [next.slice(0, slash), next.slice(slash + 1)]
  return { flowId, nodeId }
}

/** 가장 최근 사용자 말(없으면 fallback). */
export function lastUserText(messages: readonly ChatMessage[], fallback: string): string {
  return [...messages].reverse().find((item) => item.role === 'user')?.text ?? fallback
}

/** 출처 한 줄('출처' 링크 목록). */
export interface SourceLink {
  key: string
  title: string
  url: string | null
  date: string | null
  kind: 'page' | 'notice' | 'menu'
}

/**
 * 서버 답 아래 '출처' — 답에 실제로 쓴 안내를 학교 홈페이지 페이지로 묶어(같은 페이지는 한 줄) 실제 페이지 이름으로 보이고,
 * 근거로 쓴 공지·학식을 잇는다. 누르면 원문 페이지가 열린다. 안내 첫 문장을 제목으로 쓰거나 근거 원문을 대화에 펼치던 것은
 * 와닿지 않고 답이 연달아 나온 것처럼 보여 뺐다(10-16 사용자 지적).
 */
export function sourceLinks(message: Pick<ChatMessageOf<'reply'>, 'sources' | 'links'>): SourceLink[] {
  const seen = new Set<string>()
  const out: SourceLink[] = []
  for (const source of message.sources) {
    const node = findNode(source.flowId, source.nodeId)
    const link = node?.kind === 'answer' ? node.links?.[0] : undefined
    if (!link || seen.has(link.url)) continue
    seen.add(link.url)
    out.push({ key: link.url, title: link.label, url: link.url, date: null, kind: 'page' })
  }
  for (const link of message.links) {
    const key = link.url ?? link.title
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ key, title: link.title, url: link.url, date: link.date, kind: link.title.startsWith('학식 ') ? 'menu' : 'notice' })
  }
  return out
}

/** 서버 답 아래 버튼 재료 — 전화·위치(시설 id)·링크. 버튼은 서버가 보낸 것을 쓰고(링크 순서·전화를 서버만 고쳐 바꿀 수 있게), 옛 서버면 앱의 안내 데이터에서. */
export function replyButtons(item: ChatMessageOf<'reply'>): {
  phones: { label: string; phone: string }[]
  place: string | null | undefined
  links: { key: string; title: string; url: string | null; date: string | null }[]
} {
  const nodes = item.streaming
    ? []
    : item.sources.map((source) => findNode(source.flowId, source.nodeId)).filter((node): node is AskAnswerNode => node?.kind === 'answer')
  const phones = item.buttons
    ? item.buttons.phones
    : nodes
        .flatMap((node) => node.phones ?? [])
        .filter((phone, index, all) => all.findIndex((other) => other.phone === phone.phone) === index)
        .slice(0, 3)
  const place = item.buttons ? item.buttons.facilityId : nodes.find((node) => node.facilityId)?.facilityId
  const links = item.streaming
    ? []
    : item.buttons
      ? [
          ...item.buttons.pages.map((page) => ({ key: page.url, title: page.title, url: page.url as string | null, date: null as string | null })),
          ...item.links.filter((link) => link.url).map((link) => ({ key: link.url ?? link.title, title: link.title, url: link.url, date: link.date })),
        ]
      : sourceLinks(item).filter((source) => source.url)
  return { phones, place, links }
}
