import { ASK_FLOWS, type AskFlow } from '../constants/askAnswers'
import { ADMIN_OFFICE_DETAILS, type AdminOfficeContact, type AdminOfficeDetail } from '../constants/adminOffices'
import { formatFloor } from './floors'
import type { Facility } from '../types'

/**
 * '물어보기'(지도 검색바 옆 말풍선). "냉난방이 안 돼요"처럼 할 일을 물으면 그 일을 맡은 부서를 찾아 준다.
 * 학교 홈페이지 부서 안내(`ADMIN_OFFICE_DETAILS` 의 주요업무·업무별 전화)만 훑는다 — 모르는 건 지어내지 않고 못 찾았다고 한다.
 * LLM 없이 낱말로만 찾는 0단계다. 여기서 못 찾는 질문이 많으면 그때 서버 쪽 안내 봇을 붙인다.
 */

/** 한 번에 보여 줄 부서 수. 맞는 곳이 위에 오니 그 아래는 잡음에 가깝다. */
const MAX_RESULTS = 8

/**
 * 학생이 치는 말 → 부서 안내에 실제로 적힌 말. 안내 문구는 '냉,난방'·'냉‧난방'처럼 적혀 있어 문장부호를 지우고 비교한다.
 * 안내에 없는 말을 엉뚱한 부서로 잇지 않도록, 안내 원문에서 확인한 낱말만 적는다.
 */
const SYNONYMS: Record<string, readonly string[]> = {
  에어컨: ['냉난방'],
  냉방: ['냉난방'],
  난방: ['냉난방'],
  히터: ['냉난방'],
  온풍기: ['냉난방'],
  보일러: ['냉난방'],
  와이파이: ['무선'],
  wifi: ['무선'],
  인터넷: ['무선', '네트워크'],
  엘베: ['승강기'],
  엘리베이터: ['승강기'],
  증명서: ['증명'],
  잃어버: ['분실'],
  분실물: ['분실'],
  주차권: ['주차'],
  차: ['주차'],
  생활관: ['기숙사'],
  자퇴: ['제적'],
  분납: ['분할납부'],
  장소대여: ['대관', '장소'],
  강의실대여: ['대관', '장소'],
}

/** 묻는 말에 흔히 붙지만 부서를 가르지 않는 낱말. */
const STOPWORDS = new Set([
  '어디', '어디에', '어디로', '어디서', '누구', '누구한테', '전화', '전화번호', '번호', '연락', '연락처', '문의', '하나요', '해야',
  '해야돼', '해야되나요', '해야하나요', '하려면', '싶어요', '돼요', '되나요', '안돼요', '안', '어떻게', '방법', '좀', '알려줘', '알려주세요',
  '학교', '홍익대', '궁금해요', '있나요', '어디예요', '곳', '고장', '신청', '하고싶어', '문의처', '담당', '부서',
  // 일의 종류가 아니라 무엇을 묻는지만 말하는 낱말. '휴학 신청 기간'의 '기간'이 도서관 '대출기간' 같은 줄에 걸렸다(10-15).
  '기간', '일정', '언제', '마감', '기한', '절차', '방법', '서류', '어떻게해', '알려',
])

/** 낱말 끝에 붙는 조사·어미. 긴 것부터 떼어 '냉난방이'·'학생증을'·'주차는' 이 본말로 걸리게 한다. */
const SUFFIXES = ['하고싶은데', '하고싶어요', '하고싶어', '하는방법', '하려는데', '하려면', '하려고', '하는법', '신청', '하기', '에서는', '으로는', '이에요', '에서', '으로', '한테', '에게', '이랑', '해요', '하고', '은', '는', '이', '가', '을', '를', '에', '로', '도', '랑', '요']

/**
 * 공백을 지우고 소문자로, 문장부호는 낱말 경계('|')로. '세무신고, 장학금' 이 '세무신고장학금' 으로 붙어 '고장' 에 걸리지 않게 한다.
 * 다만 한 글자 뒤의 문장부호('냉,난방'·'냉‧난방'·'신‧증축')는 한 낱말을 줄여 쓴 것이라 지워서 '냉난방' 으로 잇는다.
 */
function squash(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[^가-힣a-z0-9])([가-힣])\s*[,·‧ㆍ・/]\s*/g, '$1$2')
    .replace(/\s+/g, '')
    .replace(/[.,·‧ㆍ・/\\\-()[\]{}'"`~!?:;|]+/g, '|')
}

/**
 * '휴학신청하려면' → '휴학신청' → '휴학' 처럼 두 글자 넘는 끝말은 더 없을 때까지 떼고, 한 글자 조사('이'·'가'…)는 한 번만 뗀다.
 * 한 글자를 거듭 떼면 '와이파이가' 가 '와이파' 까지 깎인다.
 */
function stripSuffix(word: string): string {
  const fits = (current: string, end: string) => current.length > end.length + 1 && current.endsWith(end)
  let current = word
  for (;;) {
    const ending = SUFFIXES.find((end) => end.length > 1 && fits(current, end))
    if (!ending) break
    current = current.slice(0, -ending.length)
  }
  const particle = SUFFIXES.find((end) => end.length === 1 && fits(current, end))
  return particle ? current.slice(0, -1) : current
}

/** 질문을 찾을 낱말 묶음으로. 낱말 하나마다 [본말, ...같은 뜻] 이고, 묶음 안에서 하나만 걸려도 그 낱말은 맞은 것으로 친다. */
export function askTerms(question: string): string[][] {
  const words = question
    .split(/[\s,.?!]+/)
    .map((word) => stripSuffix(squash(word).replace(/\|/g, '')))
    .filter((word) => word.length >= 1 && !STOPWORDS.has(word))
  const seen = new Set<string>()
  const terms: string[][] = []
  for (const word of words) {
    if (seen.has(word)) continue
    seen.add(word)
    const synonymKey = Object.keys(SYNONYMS).find((key) => word.includes(key))
    // 한 글자 낱말은 별칭이 있을 때만 쓴다('차' → 주차). 그대로 두면 거의 모든 부서에 걸린다.
    if (word.length === 1 && !synonymKey) continue
    const alternatives = [word, ...(synonymKey ? SYNONYMS[synonymKey] : [])]
    terms.push(alternatives.filter((alt, index) => alternatives.indexOf(alt) === index))
  }
  return terms
}

export interface OfficeAskResult {
  facility: Facility
  /** 부서 이름(시설 메모 맨 앞). */
  name: string
  /** '홍문관 R동 5F' */
  place: string
  /** 질문에 걸린 업무별 연락처(많아야 2줄). 업무 표에 안 걸리고 주요업무 문단에만 걸렸으면 대표 연락처 한 줄. */
  contacts: AdminOfficeContact[]
  /** 연락처 줄에 안 걸리고 주요업무 문단에만 걸렸을 때, 왜 이 부서인지 보여 줄 문단 한 토막. */
  snippet?: string
  /** 학교 홈페이지의 그 부서 안내 페이지. */
  source: string
}

/** 글에 낱말이 있는지. 바로 뒤에 '제외'가 붙은 언급('냉/난방 제외')은 그 일을 맡지 않는다는 뜻이라 치지 않는다. */
function mentions(text: string, term: string): boolean {
  let at = text.indexOf(term)
  while (at >= 0) {
    if (!text.slice(at + term.length, at + term.length + 4).replace(/\|/g, '').startsWith('제외')) return true
    at = text.indexOf(term, at + 1)
  }
  return false
}

function contactCount(item: { result: OfficeAskResult }, details: Record<string, AdminOfficeDetail>): number {
  return details[item.result.facility.id]?.contacts?.length ?? 0
}

/** 문단에서 걸린 낱말 앞뒤 한 토막. */
function snippetAround(text: string, term: string): string | undefined {
  // 원문 위치를 찾으려고 squash 한 글자마다 원문 위치를 잇는다.
  const map: number[] = []
  let squashed = ''
  for (let i = 0; i < text.length; i += 1) {
    const ch = squash(text[i]).replace(/\|/g, '')
    if (ch) {
      squashed += ch
      map.push(i)
    }
  }
  const at = squashed.indexOf(term)
  if (at < 0) return undefined
  const start = Math.max(0, map[at] - 24)
  const end = Math.min(text.length, map[at + term.length - 1] + 1 + 30)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`
}

/**
 * 질문에 맞는 부서. 낱말이 많이 걸릴수록, 업무별 전화 줄·부서 이름에 걸릴수록 앞에 둔다.
 * 시설 목록은 지도 데이터 것을 받는다 — 부서 위치(건물·층)와 시트 열기를 지도와 같은 길로 하려고.
 */
export function askOffices(
  facilities: readonly Facility[],
  question: string,
  details: Record<string, AdminOfficeDetail> = ADMIN_OFFICE_DETAILS,
): OfficeAskResult[] {
  const terms = askTerms(question)
  if (terms.length === 0) return []

  const scored: { result: OfficeAskResult; score: number; matched: number; strong: boolean }[] = []
  for (const facility of facilities) {
    const detail = details[facility.id]
    if (!detail) continue
    const name = facility.note?.split('·')[0]?.trim() || facility.kind
    const nameText = squash(name)
    const summaryText = squash(detail.summary ?? '')
    const contacts = detail.contacts ?? []
    const contactTexts = contacts.map((contact) => squash(contact.duty))

    let score = 0
    let matched = 0
    let strong = false
    const hitContacts = new Set<number>()
    let snippetTerm: string | null = null
    for (const alternatives of terms) {
      let termHit = false
      for (const alt of alternatives) {
        if (nameText.includes(alt)) {
          score += 6
          termHit = true
          strong = true
        }
        contactTexts.forEach((text, index) => {
          if (mentions(text, alt)) {
            hitContacts.add(index)
            termHit = true
            strong = true
          }
        })
        if (mentions(summaryText, alt)) {
          score += 2
          termHit = true
          snippetTerm ??= alt
        }
      }
      if (termHit) matched += 1
    }
    if (matched === 0) continue
    if (hitContacts.size > 0) score += 4

    // 같은 번호가 업무만 달리해 두 줄로 적힌 경우가 있어(학사지원팀 1089) 번호마다 첫 줄만 남긴다.
    const hitRows = [...hitContacts].map((index) => contacts[index])
    const shownContacts =
      hitRows.length > 0
        ? hitRows.filter((row, index) => hitRows.findIndex((other) => other.phone === row.phone) === index).slice(0, 2)
        : contacts.slice(0, 1)
    scored.push({
      score,
      matched,
      strong,
      result: {
        facility,
        name,
        place: [facility.buildingName, facility.floor !== undefined ? formatFloor(facility.floor) : null].filter(Boolean).join(' '),
        contacts: shownContacts,
        snippet: hitContacts.size === 0 && snippetTerm ? snippetAround(detail.summary ?? '', snippetTerm) : undefined,
        source: detail.source,
      },
    })
  }

  // 이름·업무별 연락처에 걸린 부서가 있으면, 주요업무 문단에만 스친 부서(연구센터 소개의 '무선전력전송' 등)는 뺀다.
  // 그런 부서가 하나도 없을 때만 문단 쪽을 보여 준다('주차'는 관재팀 문단에만 있다).
  const anyStrong = scored.some((item) => item.strong)
  const relevant = anyStrong ? scored.filter((item) => item.strong) : scored

  // 상위 부서(사무처·교무처)는 아래 팀의 연락처를 그대로 함께 싣고 있어, 같은 번호가 여러 부서로 겹쳐 나온다.
  // 첫 연락처 번호가 같으면 한 부서로 보고, 연락처가 적은 쪽(팀 — 더 좁게 맡은 곳)을 남긴다.
  const unique = new Map<string, (typeof scored)[number]>()
  for (const item of relevant.sort((a, b) => b.matched - a.matched || b.score - a.score)) {
    const key = item.result.contacts[0]?.phone ?? item.result.name
    const kept = unique.get(key)
    if (!kept || (kept.matched === item.matched && contactCount(item, details) < contactCount(kept, details))) {
      // Map 순서는 처음 넣은 자리를 지키므로 바꿔 넣어도 순위는 그대로다.
      unique.set(key, item)
    }
  }
  return [...unique.values()].slice(0, MAX_RESULTS).map((item) => item.result)
}

/** 안내 흐름(`ASK_FLOWS`) 가운데 질문에 맞는 첫 흐름과 시작할 단계. 질문이 상황을 이미 말하면 되묻지 않고 그 답에서 시작한다. */
export function matchAskFlow(
  question: string,
  flows: readonly AskFlow[] = ASK_FLOWS,
): { flow: AskFlow; nodeId: string } | null {
  const text = squash(question).replace(/\|/g, '')
  if (!text) return null
  for (const flow of flows) {
    const entry = flow.entries.find((candidate) => candidate.match.every((group) => group.some((word) => text.includes(word))))
    if (entry) return { flow, nodeId: entry.node }
  }
  return null
}
