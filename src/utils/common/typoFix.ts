import { combineCharacter, convertQwertyToHangul, disassemble, disassembleCompleteCharacter } from 'es-hangul'

/**
 * 물어보기 질문의 오타를 학교 용어로 바로잡는다(11-06 운영진 요청).
 *
 * 용어 사전은 따로 만들지 않고 안내 흐름의 낱말(entries[].match)을 그대로 쓴다 — 한글 두 글자 이상만.
 * 질문(squash 한 글)에서 사전 낱말과 같은 길이의 글자 묶음을 보고, 다음 두 가지만 고친다.
 *  1) 쉬프트·모음 헷갈림: ㄲ·ㄸ·ㅃ·ㅆ·ㅉ ↔ 홑자음, ㅒ↔ㅐ, ㅖ↔ㅔ, ㅐ↔ㅔ('였어'→'엿어', '쓸수있'→'쓸수잇', '세미나'↔'새미나').
 *     글자 수와 상관없이 이것만 다르면 고친다.
 *  2) 한 글자 안에서 자모 하나가 틀림(넣기·빼기·바꾸기 한 번): '휴핵'→'휴학', '졸엄'→'졸업', '의의신청'→'이의신청'.
 *     틀린 글자는 한 글자만. 사전에 이미 있는 낱말 안쪽은 고치지 않는다(맞는 말을 다른 말로 바꾸지 않게).
 * 맞게 쓴 다른 말을 바꾸지 않게 두 가지를 더 본다.
 *  - 띄어 쓴 낱말 하나 안에서만 고친다('버디 보고서'의 '버디보'를 보지 않는다).
 *  - 고칠 글자가 든 두 글자('운행'·'교화'·'공결')가 안내 원문에 나오면 실제로 쓰는 말이라 고치지 않는다.
 *    오타로 생긴 두 글자('휴핵'·'졸엄'·'엿어')는 원문에 없다. 원문 = 흐름의 답·되묻기 글 전부(nodes).
 *  - 두 글자 낱말은 한 글자만 달라도 다른 말이 되기 쉬워('운행'↔'은행', '증권'↔'증원') 받침이 틀렸거나
 *    자주 헷갈리는 모음 짝(ㅏㅐ·ㅓㅔ·ㅑㅒ·ㅕㅖ·ㅗㅚ·ㅜㅟ)일 때만 자모 하나 고치기를 한다.
 * 학교 용어가 아닌 일반 낱말의 쉬프트 오타('엿어'→'였어', '햇는데'→'했는데')는 안내 원문의 두 글자로 고친다:
 *  지금 두 글자가 원문에 없고, ㅅ↔ㅆ 같은 짝으로 바꾼 글자가 원문에 하나뿐일 때만.
 * 영문 자판으로 친 한글('gbgkr' → '휴학')은 질문이 영문 소문자뿐이고 원래 질문이 어디에도 안 걸릴 때만 바꿔 본다.
 */

/** 쉬프트를 덜/더 누르거나 모음을 헷갈린 짝 → 하나로 모은 자모. */
const FOLD: Record<string, string> = {
  ㄲ: 'ㄱ',
  ㄸ: 'ㄷ',
  ㅃ: 'ㅂ',
  ㅆ: 'ㅅ',
  ㅉ: 'ㅈ',
  ㅒ: 'ㅐ',
  ㅖ: 'ㅐ',
  ㅔ: 'ㅐ',
}

const HANGUL_WORD = /^[가-힣]{2,}$/
const SYLLABLE = /[가-힣]/

function folded(text: string): string {
  return Array.from(disassemble(text), (ch) => FOLD[ch] ?? ch).join('')
}

/** 자모 편집 거리(넣기·빼기·바꾸기 각 1). 짧은 글(한 글자의 자모 2~6개)만 비교한다. */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const up = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = up
    }
  }
  return row[b.length]
}

export interface AskVocabulary {
  words: Set<string>
  /** 긴 것부터 */
  lengths: number[]
  /** 쉬프트·모음을 모은 글 → 낱말 */
  byFold: Map<string, string[]>
  /** 한 자리를 '*'로 가린 글 → 낱말('휴*' → 휴학·휴관…) */
  byMask: Map<string, string[]>
  /** 안내 원문에 나오는 한글 두 글자 */
  bigrams: Set<string>
}

type FlowsLike = readonly { entries: readonly { match: readonly (readonly string[])[] }[]; nodes?: unknown }[]

const cache = new WeakMap<object, AskVocabulary>()

function push(map: Map<string, string[]>, key: string, word: string) {
  const list = map.get(key)
  if (!list) map.set(key, [word])
  else if (!list.includes(word)) list.push(word)
}

/** flows 의 match 낱말로 사전을 만든다(흐름 목록마다 한 번). */
export function askVocabulary(flows: FlowsLike): AskVocabulary {
  const hit = cache.get(flows)
  if (hit) return hit
  const words = new Set<string>()
  for (const flow of flows)
    for (const entry of flow.entries)
      for (const group of entry.match)
        for (const word of group) if (HANGUL_WORD.test(word)) words.add(word)
  const byFold = new Map<string, string[]>()
  const byMask = new Map<string, string[]>()
  const lengths = new Set<number>()
  for (const word of words) {
    lengths.add(word.length)
    push(byFold, folded(word), word)
    for (let i = 0; i < word.length; i += 1) push(byMask, `${word.slice(0, i)}*${word.slice(i + 1)}`, word)
  }
  const bigrams = new Set<string>()
  for (const flow of flows) {
    for (const run of JSON.stringify(flow.nodes ?? {}).match(/[가-힣]{2,}/g) ?? []) {
      for (let i = 0; i + 1 < run.length; i += 1) bigrams.add(run.slice(i, i + 2))
    }
  }
  const vocab: AskVocabulary = { words, lengths: [...lengths].sort((a, b) => b - a), byFold, byMask, bigrams }
  cache.set(flows, vocab)
  return vocab
}

export interface TypoFix {
  from: string
  to: string
  at: number
}

const VOWEL_PAIRS = new Set(['ㅏㅐ', 'ㅐㅏ', 'ㅓㅔ', 'ㅔㅓ', 'ㅑㅒ', 'ㅒㅑ', 'ㅕㅖ', 'ㅖㅕ', 'ㅗㅚ', 'ㅚㅗ', 'ㅜㅟ', 'ㅟㅜ'])

/** 두 글자 낱말에서 허용하는 한 글자 차이: 받침만 다르거나, 자주 헷갈리는 모음 짝만 다르다. */
function looseSyllable(a: string, b: string): boolean {
  const x = disassembleCompleteCharacter(a)
  const y = disassembleCompleteCharacter(b)
  if (!x || !y) return false
  if (x.choseong !== y.choseong) return false
  if (x.jungseong === y.jungseong) return x.jongseong !== y.jongseong
  return x.jongseong === y.jongseong && VOWEL_PAIRS.has(x.jungseong + y.jungseong)
}

/** 이 글자 묶음을 고칠 낱말(없거나 애매하면 null). 쉬프트·모음 헷갈림이 먼저, 그다음 한 글자 자모 하나. */
function candidateFor(window: string, vocab: AskVocabulary): string | null {
  const byFold = vocab.byFold.get(folded(window))?.filter((word) => word !== window)
  if (byFold && byFold.length === 1) return byFold[0]
  if (byFold && byFold.length > 1) return null
  let found: string | null = null
  for (let i = 0; i < window.length; i += 1) {
    const list = vocab.byMask.get(`${window.slice(0, i)}*${window.slice(i + 1)}`)
    if (!list) continue
    for (const word of list) {
      if (word === window || editDistance(folded(window[i]), folded(word[i])) !== 1) continue
      if (window.length === 2 && !looseSyllable(window[i], word[i])) continue
      if (found && found !== word) return null
      found = word
    }
  }
  return found
}

/** 바뀌는 글자가 든 두 글자(질문 글 그대로)가 안내 원문에 나오면 true — 실제로 쓰는 말이라 고치지 않는다. */
function seenInGuides(chars: string[], at: number, window: string, to: string, vocab: AskVocabulary): boolean {
  for (let k = 0; k < window.length; k += 1) {
    if (window[k] === to[k]) continue
    const i = at + k
    const left = i > 0 && SYLLABLE.test(chars[i - 1]) ? chars[i - 1] + chars[i] : null
    const right = i + 1 < chars.length && SYLLABLE.test(chars[i + 1]) ? chars[i] + chars[i + 1] : null
    if ((left && vocab.bigrams.has(left)) || (right && vocab.bigrams.has(right))) return true
  }
  return false
}

// 일반 낱말은 쉬프트 짝만(ㅐ↔ㅔ 는 '패스워드'·'페스티벌'처럼 외래어에서 헷갈려 학교 용어에서만 고친다).
const SHIFT_GROUPS = [['ㄱ', 'ㄲ'], ['ㄷ', 'ㄸ'], ['ㅂ', 'ㅃ'], ['ㅅ', 'ㅆ'], ['ㅈ', 'ㅉ'], ['ㅐ', 'ㅒ'], ['ㅔ', 'ㅖ']]

function swaps(ch: string): string[] {
  return SHIFT_GROUPS.find((group) => group.includes(ch))?.filter((other) => other !== ch) ?? []
}

/** ㅅ↔ㅆ·ㅐ↔ㅔ 같은 짝으로 바꾼 같은 글자들(자기 자신 빼고). */
function shiftVariants(syllable: string): string[] {
  const parts = disassembleCompleteCharacter(syllable)
  if (!parts) return []
  const out = new Set<string>()
  const { choseong: c, jungseong: v, jongseong: t } = parts
  const tail = t.length <= 1 ? t : null // 겹받침은 건드리지 않는다
  for (const c2 of swaps(c)) out.add(combineCharacter(c2, v, t))
  for (const v2 of swaps(v)) out.add(combineCharacter(c, v2, t))
  if (tail) for (const t2 of swaps(tail)) {
    try {
      out.add(combineCharacter(c, v, t2))
    } catch {
      // ㄸ·ㅃ·ㅉ 은 받침이 될 수 없다
    }
  }
  out.delete(syllable)
  return [...out]
}

/** 일반 낱말의 쉬프트 오타를 안내 원문의 두 글자로 고친다('엿어'→'였어'). */
function fixShiftWords(word: string, vocab: AskVocabulary): string {
  const chars = Array.from(word)
  for (let i = 0; i < chars.length; i += 1) {
    if (!SYLLABLE.test(chars[i])) continue
    const left = i > 0 && SYLLABLE.test(chars[i - 1]) ? chars[i - 1] : null
    const right = i + 1 < chars.length && SYLLABLE.test(chars[i + 1]) ? chars[i + 1] : null
    if (!left && !right) continue
    // 지금 글자는 양옆 어느 쪽과도 원문에 안 나오고, 바꾼 글자는 한쪽 이상과 나올 때만.
    const seen = (s: string) => (left !== null && vocab.bigrams.has(left + s)) || (right !== null && vocab.bigrams.has(s + right))
    if (seen(chars[i])) continue
    const ok = shiftVariants(chars[i]).filter(seen)
    if (ok.length === 1) chars[i] = ok[0]
  }
  return chars.join('')
}

/** 질문(띄어쓰기 그대로)의 낱말마다 오타를 고쳐 다시 잇는다. 바뀐 게 없으면 null. */
export function fixQuestionTypos(question: string, vocab: AskVocabulary): string | null {
  let changed = false
  const words = question.toLowerCase().split(/\s+/).map((word) => {
    // 쉬프트 오타를 먼저 고친다 — '받앗어요'가 받침 빼기('받아')보다 '받았어요'로 가야 한다.
    const shifted = fixShiftWords(word, vocab)
    const fixed = fixTypos(shifted, vocab)
    if (fixed.fixes.length > 0 || shifted !== word) changed = true
    return fixed.text
  })
  return changed ? words.join(' ') : null
}

/**
 * squash 한 질문 글에서 오타를 고친다. 바뀐 게 없으면 fixes 가 빈 배열.
 * 긴 낱말부터, 서로 겹치지 않게 고친다. 사전 낱말이 그대로 있는 자리 안쪽은 건드리지 않는다.
 */
export function fixTypos(text: string, vocab: AskVocabulary): { text: string; fixes: TypoFix[] } {
  const chars = Array.from(text)
  const exact = new Array<number>(chars.length).fill(0) // 그 자리를 덮는 가장 긴 사전 낱말 길이
  for (const length of vocab.lengths) {
    for (let at = 0; at + length <= chars.length; at += 1) {
      if (!vocab.words.has(chars.slice(at, at + length).join(''))) continue
      for (let k = at; k < at + length; k += 1) exact[k] = Math.max(exact[k], length)
    }
  }
  const taken = new Array<boolean>(chars.length).fill(false)
  const fixes: TypoFix[] = []
  for (const length of vocab.lengths) {
    for (let at = 0; at + length <= chars.length; at += 1) {
      const slice = chars.slice(at, at + length)
      if (!slice.every((ch) => SYLLABLE.test(ch))) continue
      if (slice.some((_, k) => taken[at + k])) continue
      if (slice.every((_, k) => exact[at + k] >= length)) continue
      const window = slice.join('')
      if (vocab.words.has(window)) continue
      const to = candidateFor(window, vocab)
      if (!to || seenInGuides(chars, at, window, to, vocab)) continue
      fixes.push({ from: window, to, at })
      for (let k = 0; k < length; k += 1) taken[at + k] = true
    }
  }
  if (fixes.length === 0) return { text, fixes }
  const out = [...chars]
  for (const fix of fixes) out.splice(fix.at, fix.to.length, ...Array.from(fix.to))
  return { text: out.join(''), fixes: fixes.sort((a, b) => a.at - b.at) }
}

/** 영문 자판으로 친 한글이면 한글로('gbgkrtlscjd' → '휴학신청'). 영문 소문자(와 숫자)뿐일 때만, 아니면 null. */
export function qwertyToHangul(text: string): string | null {
  if (!/^[a-z|0-9]+$/.test(text) || !/[a-z]{2,}/.test(text)) return null
  try {
    const converted = convertQwertyToHangul(text)
    return /[가-힣]/.test(converted) ? converted : null
  } catch {
    return null
  }
}
