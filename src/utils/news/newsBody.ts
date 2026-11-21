/**
 * 크롤러가 가져온 공지 본문은 줄바꿈이 전부 공백으로 뭉개져 한 줄로 온다
 * (예: "… 신청 부탁드립니다. ∎ 프로그램명: … ∎ 장소: … 1. 신청 방법 - 기간: …").
 * 원문에 남아 있는 표시(■·◆·∎·※·"-"·"1."·"가." 등)를 기준으로 줄을 다시 나눠 읽기 쉬운 덩어리로 바꾼다.
 * 원문 글자는 고치거나 지우지 않는다 — 줄을 나누고, 중복 기호만 정리한다.
 */

export type NewsBlock =
  | { type: 'paragraph'; text: string }
  /** "1. 프로그램 상세 내용", "가. 등록 기간" 처럼 번호로 시작하는 소제목 줄. */
  | { type: 'heading'; marker: string; text: string }
  /**
   * 기호(■·◆·∎·- 등)로 시작하는 항목. "접수기한 : 10/19" 꼴이면 label 로 나눠 굵게 보여 준다.
   * marker 가 있으면(가.·나.·①) 점 대신 그 표시를 앞에 둔다.
   */
  | { type: 'bullet'; label?: string; text: string; depth: 0 | 1; marker?: string }
  /** ※·* 로 시작하는 주의 문구. */
  | { type: 'note'; text: string }

/**
 * 항목 기호. 원문마다 제각각이라 넓게 받는다. 화살표(▶·➤ 등)는 "클래스넷 ➤ 상담/설문" 같은 메뉴 경로나
 * "신청하기▶▶" 처럼 문장 안에 쓰여 줄을 나누지 않는다.
 */
const BULLET_CHARS = '■□▣▪▫∎◆◇●○◎•★☆✔✓❖'
const NOTE_CHARS = '※'
const BULLET_RE = new RegExp(`[${BULLET_CHARS}]+`, 'g')

/** 줄을 나눌 자리에 넣는 표시. 본문에 나올 리 없는 문자. */
const BREAK = '\u0000'

function insertBreaks(raw: string): string {
  let s = raw.replace(/\r\n?/g, '\n').replace(/[ \t ]+/g, ' ')
  // 원래 줄바꿈이 살아 있는 본문은 그대로 줄로 쓴다.
  s = s.replace(/\n+/g, BREAK)
  // 같은 기호가 겹친 것(∎∎∎)은 하나로.
  s = s.replace(BULLET_RE, (m) => m[0])
  // 기호 앞에서 줄을 나눈다(문장 중간 기호라도 원문에선 거의 줄머리였다).
  s = s.replace(new RegExp(`\\s*([${BULLET_CHARS}${NOTE_CHARS}])\\s*`, 'g'), `${BREAK}$1 `)
  // "* 문구" 주의 줄(앞이 공백이고 뒤가 공백인 별표).
  s = s.replace(/(^|\s)\*\s+(?=\S)/g, `${BREAK}* `)
  // " - 항목": 앞뒤가 공백인 하이픈. 숫자 사이(10:00 - 12:00)는 그대로 둔다.
  s = s.replace(/\s+-\s+(?=[^\d\s])/g, `${BREAK}- `)
  // 문장 끝에 홀로 남은 "-"(원문 표의 빈칸 흔적)는 지운다.
  s = s.replace(/\s+-\s*$/g, '')
  // " 1. 제목" / " 2) 제목" / "① 제목": 앞이 공백, 번호 1~20, 뒤가 숫자가 아닌 글자(날짜 "2026. 11. 27." 은 제외).
  s = s.replace(/(^|\s)((?:[1-9]|1\d|20)[.)])\s+(?=[^\d\s])/g, `${BREAK}$2 `)
  s = s.replace(/\s*([①-⑳])\s*/g, `${BREAK}$1 `)
  // " 가. 제목" (가~하 한 글자 + 마침표).
  s = s.replace(/(^|\s)([가나다라마바사아자차카타파하]\.)\s+(?=\S)/g, `${BREAK}$2 `)
  return s
}

/** "접수기한 : ~10/19" → label/text. 라벨은 짧은 명사구일 때만(문장 속 콜론은 건드리지 않는다). */
function splitLabel(text: string): { label?: string; text: string } {
  const m = /^([^:：]{1,20}?)\s*[:：]\s*(.+)$/.exec(text)
  if (!m) return { text }
  const label = m[1].trim()
  // 시간(10:00)·URL(https:)·문장이 라벨로 잡히지 않게.
  if (/\d$/.test(label) || /https?$/i.test(label) || /[.!?]$/.test(label) || label.split(' ').length > 5) return { text }
  return { label, text: m[2].trim() }
}

export function formatNewsBody(raw: string): NewsBlock[] {
  if (!raw || !raw.trim()) return []
  const lines = insertBreaks(raw.trim())
    .split(BREAK)
    .map((line) => line.trim())
    // 기호만 남은 줄(∎·※·- 등)은 버린다.
    .filter((line) => line.length > 0 && !new RegExp(`^[-*※${BULLET_CHARS}\\s]+$`).test(line))

  const blocks: NewsBlock[] = []
  let inSection = false
  for (const line of lines) {
    // "가." "나." "①" 은 소제목 아래 하위 항목으로 둔다.
    const sub = /^([가나다라마바사아자차카타파하]\.|[①-⑳])\s+(.+)$/.exec(line)
    if (sub) {
      blocks.push({ type: 'bullet', marker: sub[1], ...splitLabel(sub[2]), depth: inSection ? 1 : 0 })
      continue
    }
    const heading = /^((?:[1-9]|1\d|20)[.)])\s+(.+)$/.exec(line)
    if (heading) {
      // "1. 문의: 02-…" 처럼 번호 줄이 짧은 값 항목이면 항목으로, 아니면 소제목으로.
      const body = heading[2]
      const kv = splitLabel(body)
      if (kv.label && body.length <= 60) {
        blocks.push({ type: 'bullet', label: `${heading[1]} ${kv.label}`, text: kv.text, depth: 0 })
      } else {
        blocks.push({ type: 'heading', marker: heading[1], text: body })
      }
      inSection = true
      continue
    }
    const note = /^(?:※|\*)\s*(.+)$/.exec(line)
    if (note) {
      blocks.push({ type: 'note', text: note[1] })
      continue
    }
    const bullet = new RegExp(`^([${BULLET_CHARS}]|-)\\s*(.+)$`).exec(line)
    if (bullet) {
      const kv = splitLabel(bullet[2])
      // "-" 항목은 번호 소제목 아래에 들여 쓴다.
      blocks.push({ type: 'bullet', ...kv, depth: bullet[1] === '-' && inSection ? 1 : 0 })
      continue
    }
    for (const chunk of splitLongParagraph(line)) blocks.push({ type: 'paragraph', text: chunk })
  }
  return blocks
}

/** 긴 안내 문단(150자 넘음)은 두 문장씩 끊어 문단을 나눈다. "…합니다. 이번 …" 처럼 문장 끝 + 공백에서만 끊는다. */
function splitLongParagraph(text: string): string[] {
  if (text.length <= 150) return [text]
  const sentences = text.split(/(?<=[다요죠까][.!?])\s+(?=\S)/)
  if (sentences.length <= 2) return [text]
  const out: string[] = []
  for (let i = 0; i < sentences.length; i += 2) out.push(sentences.slice(i, i + 2).join(' '))
  return out
}

/** 본문 속 링크·메일 주소를 눌러 열 수 있게 조각으로 나눈다. */
export type InlinePart = { kind: 'text'; text: string } | { kind: 'link'; text: string; url: string }

const LINK_RE = /(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g

export function splitLinks(text: string): InlinePart[] {
  const parts: InlinePart[] = []
  let last = 0
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index ?? 0
    let raw = m[0]
    // 문장 끝 마침표·쉼표는 링크에서 뺀다.
    const trailing = /[.,;:]+$/.exec(raw)?.[0] ?? ''
    if (trailing) raw = raw.slice(0, -trailing.length)
    if (start > last) parts.push({ kind: 'text', text: text.slice(last, start) })
    const isMail = raw.includes('@') && !raw.startsWith('http')
    const url = isMail ? `mailto:${raw}` : raw.startsWith('www.') ? `https://${raw}` : raw
    parts.push({ kind: 'link', text: raw, url })
    last = start + raw.length
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
  return parts
}
