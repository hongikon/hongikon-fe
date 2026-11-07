import type { AskFlow } from '../constants/askAnswers'
import { ALL_ASK_FLOWS, matchAskFlow } from './officeAsk'

/**
 * 물어보기 인사(11-07 운영진 요청) — 하이·ㅎㅇ·안녕처럼 인사만 오면 서버(LLM)로 보내지 않고 앱이 받아,
 * '요즘 많이 찾는 안내'(GET /ask/popular) 칩을 보여 준다. 칩은 앱 안 안내를 바로 연다(한도·비용 없음).
 */

/** 인사 낱말(공백·문장부호·끝 ㅋㅎ 를 지운 뒤 통째로 같아야 한다). '안녕 T동 어디야'처럼 뒤에 질문이 붙으면 인사가 아니다. */
const GREETINGS = new Set([
  'ㅎㅇ', 'ㅎㅇㅎㅇ', 'ㅎ2', 'ㅎㅇ요', '하이', '하이요', '하위', '하이루', '방가', '방가방가', '반가워', '반가워요', '반갑습니다',
  '안녕', '안뇽', '안녕하세요', '안녕하십니까', 'ㅇㄴ', 'ㅇㄴㅎㅅㅇ', '헬로', '헬로우', 'hi', 'hello', 'hey', 'hii', 'helo',
  '저기요', '여기요',
])

export function isGreeting(text: string): boolean {
  const squashed = text
    .toLowerCase()
    .replace(/[\s~!?.,·…^]+/g, '')
    // 끝에 붙은 웃음·울음(ㅋㅋ, ㅎㅎ, ㅠ)은 뗀다. 'ㅎㅇ' 처럼 인사 자체가 ㅎ 으로 끝나지 않으니 안전하다.
    .replace(/(?<=.)[ㅋㅎㅠㅜ]+$/u, '')
  return squashed.length > 0 && squashed.length <= 12 && GREETINGS.has(squashed)
}

/** 인사 다음에 띄우는 칩 하나 — 누르면 그 흐름의 그 단계를 연다. */
export interface GreetingGuide {
  flowId: string
  nodeId: string
  label: string
}

const LABEL_MAX = 16
const FILLER = new Set(['어디', '방법', '어떻게', '언제'])

/** 단계 이름 — 되묻기 버튼·이어 묻기에 붙은 이름이 있으면 그것, 없으면 그 단계로 들어오는 첫 낱말들('기숙사 통금'). */
function labelOf(flow: AskFlow, nodeId: string): string | null {
  for (const node of Object.values(flow.nodes)) {
    const options = node.kind === 'question' ? node.options : (node.followUps ?? [])
    const option = options.find((item) => item.next === nodeId || item.next === `${flow.id}/${nodeId}`)
    if (option) return option.label
  }
  const entry = flow.entries.find((item) => item.node === nodeId)
  if (!entry) return null
  const words = [...new Set(entry.match.map((group) => group[0]))].filter((word) => !FILLER.has(word))
  return words.length > 0 ? words.join(' ') : null
}

/** 서버가 준 안내 id(flow/node) → 칩. 앱이 모르는 id(새 안내가 아직 OTA 전)·이름을 못 붙이는 것은 뺀다. */
export function guidesFromIds(ids: readonly string[], flows: readonly AskFlow[] = ALL_ASK_FLOWS): GreetingGuide[] {
  const out: GreetingGuide[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const slash = id.indexOf('/')
    if (slash < 0) continue
    const flow = flows.find((item) => item.id === id.slice(0, slash))
    const nodeId = id.slice(slash + 1)
    if (!flow?.nodes[nodeId]) continue
    const label = labelOf(flow, nodeId)
    if (!label || label.length > LABEL_MAX || seen.has(label)) continue
    seen.add(label)
    out.push({ flowId: flow.id, nodeId, label })
  }
  return out
}

/** 아직 많이 찾는 안내가 없을 때(기록이 적거나 서버가 모름) 보이는 기본 칩. 모두 앱 안에 답이 있는 것. */
const DEFAULT_QUESTIONS = ['휴학 신청', '학생증 재발급', '와이파이 연결 방법', '학교 메일 계정', '장학금 종류', '수강신청'] as const

export function defaultGuides(flows: readonly AskFlow[] = ALL_ASK_FLOWS): GreetingGuide[] {
  return DEFAULT_QUESTIONS.flatMap((label) => {
    const matched = matchAskFlow(label, flows)
    return matched ? [{ flowId: matched.flow.id, nodeId: matched.nodeId, label }] : []
  })
}
