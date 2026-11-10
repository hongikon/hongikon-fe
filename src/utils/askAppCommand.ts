import { SUBSCRIBABLE_ITEMS, type SubscribableItem } from '../constants/news'
import type { CategoryKey } from '../constants/colors'
import { ALL_CATEGORIES } from './settingsStorage'

/**
 * 물어보기로 앱 설정 바꾸기·화면 열기(11-09 운영진 — '화학공학과 구독해줘', '알림 설정 어떻게 해').
 * docs/ask-app-actions-plan.md 2장: 앱 안에서 정해진 말로만 알아듣고(LLM·서버 없음), 바꾸는 것은 확인 버튼을 눌러야만 바뀐다.
 * 잘못 알아들어도 아무것도 바뀌지 않는다. 위치·근처 알림처럼 동의가 필요한 설정은 여기서 다루지 않는다.
 */
export type AskAppCommand =
  /** 게시판 구독·해제. boards 가 둘 이상이면 학생이 고른다. */
  | { kind: 'subscribe'; on: boolean; boards: SubscribableItem[] }
  /** 구독한 게시판 하나의 알림 켜고 끄기. */
  | { kind: 'boardAlert'; on: boolean; boards: SubscribableItem[] }
  /** 알림 전체(구독 소식 알림) 켜고 끄기. */
  | { kind: 'alertAll'; on: boolean }
  /** 분야별 알림(공지·장학·행사·수강·시설·취업·상담). */
  | { kind: 'alertCategory'; on: boolean; category: CategoryKey }
  /** 바꾸지 않고 설정 화면만 연다(방법을 물었을 때). */
  | { kind: 'open'; screen: 'alerts' | 'subscriptions' }

const HOW = /(어떻게|방법|어디서|어디|는법|설정법|바꾸|바꿔|열어|보여)/
const OFF = /(꺼|끄|끈|off|그만|안받|받기싫|싫어|멈춰|중지)/
const ON = /(켜|켠|on|받고싶|받을래|받게|받아)/
const UNSUBSCRIBE = /구독(을|좀)?(취소|해지|해제|끊|그만|빼|삭제|안할)/
const SUBSCRIBE = /구독(을|좀)?(해|할래|하고싶|시켜|추가|신청|부탁|$)/
const MAX_TEXT = 40
const MAX_BOARDS = 3

function squash(text: string): string {
  return text.toLowerCase().replace(/[\s~!?.,·…^]+/g, '')
}

/** 게시판 이름의 줄기 — '화학공학전공' → '화학공학', '컴퓨터공학과' → '컴퓨터공학', '국제교류실 공지' → '국제교류실'. */
function stem(name: string): string {
  return squash(name).replace(/(공지|게시판)$/, '').replace(/(학과|학부|전공|과)$/, '')
}

/** 질문에 이름(줄기)이 든 게시판 — 가장 긴 줄기만('공학'보다 '화학공학'), 최대 3개. */
export function matchBoards(text: string, items: readonly SubscribableItem[] = SUBSCRIBABLE_ITEMS): SubscribableItem[] {
  const squashed = squash(text)
  let best = 0
  let found: SubscribableItem[] = []
  for (const item of items) {
    const s = stem(item.name)
    if (s.length < 2 || !squashed.includes(s)) continue
    if (s.length > best) {
      best = s.length
      found = [item]
    } else if (s.length === best && !found.some((f) => f.id === item.id)) {
      found.push(item)
    }
  }
  return found.slice(0, MAX_BOARDS)
}

export function parseAskAppCommand(text: string, items: readonly SubscribableItem[] = SUBSCRIBABLE_ITEMS): AskAppCommand | null {
  const squashed = squash(text)
  if (!squashed || squashed.length > MAX_TEXT) return null
  const hasSubscribe = squashed.includes('구독')
  const hasAlert = squashed.includes('알림') || squashed.includes('푸시')
  if (!hasSubscribe && !hasAlert) return null
  const how = HOW.test(squashed)
  const boards = matchBoards(squashed, items)

  if (hasSubscribe && !hasAlert) {
    if (boards.length > 0 && UNSUBSCRIBE.test(squashed)) return { kind: 'subscribe', on: false, boards }
    if (boards.length > 0 && SUBSCRIBE.test(squashed) && !how) return { kind: 'subscribe', on: true, boards }
    return how ? { kind: 'open', screen: 'subscriptions' } : null
  }
  // 알림
  const off = OFF.test(squashed)
  const on = !off && ON.test(squashed)
  if ((on || off) && !how) {
    // 분야 이름이 '알림' 바로 앞이면 분야 알림이 먼저('장학 알림' — 같은 이름의 장학 게시판보다).
    const category = ALL_CATEGORIES.find((cat) => squashed.includes(`${cat}알림`))
    if (category) return { kind: 'alertCategory', on, category }
    if (boards.length > 0) return { kind: 'boardAlert', on, boards }
    if (/^(전체|모든|모두)?(앱)?(알림|푸시)(을|좀|다|전부)?/.test(squashed)) return { kind: 'alertAll', on }
    return null
  }
  return how ? { kind: 'open', screen: 'alerts' } : null
}

const NOTICE_WORD = /(공지사항|공지|소식|게시글|게시판)/
const FIND_WORD = /(찾아|검색|찾을)/
const FILLER = new Set(['지금', '좀', '관련', '있는', '최근', '요즘', '올라온', '나온', '거', '것', '내용', '혹시'])

/**
 * '지금 공지사항에 있는 장학금 신청 찾아줘'(11-09 운영진) → '장학금 신청'. 서버가 공지를 찾아 답하고, 앱은 답 아래
 * '소식에서 검색' 버튼으로 소식 탭 게시글 검색(제목)을 그 말로 연다. 공지·찾기 낱말이 둘 다 없으면 null.
 */
export function newsSearchQuery(text: string): string | null {
  if (!NOTICE_WORD.test(text) || !FIND_WORD.test(text)) return null
  const words = text
    .replace(/[?!.,~]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/(공지사항|공지|소식|게시글|게시판)(에서|에서의|에|중에|중|을|를|좀)?$/, ''))
    .map((word) => word.replace(/(찾아|검색|찾을)\S*$/, ''))
    .filter((word) => word.length >= 2 && !FILLER.has(word))
  const query = words.join(' ').trim()
  return query.length > 0 && query.length <= 30 ? query : null
}
