// 오타 교정(src/utils/typoFix.ts) 평가: cases/*.json 질문에 흔한 오타를 하나씩 넣어 교정 전후 경로 정답률을 비교한다.
// 사용: node scripts/ask/typo-eval.mjs [--seed 1] [--show 20]
// 오타 종류(질문마다 종류별로 한 개씩, 넣을 자리가 없으면 건너뜀):
//  - shift : 쌍자음·ㅒ·ㅖ 를 쉬프트 없이(ㅆ→ㅅ, ㄲ→ㄱ, ㅒ→ㅐ …) — '였어'→'엿어'
//  - near  : 한 글자의 자모 하나를 두벌식 자판 옆 글쇠로(같은 줄 왼쪽·오른쪽, 자음은 자음·모음은 모음끼리)
//  - batchim: 한 글자의 받침을 빠뜨림('졸업'→'조업')
// 'none' 정답(안내 흐름 없음)도 오타를 넣어 엉뚱한 안내로 가지 않는지 본다.
import { register } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'
import { combineCharacter, disassembleCompleteCharacter } from 'es-hangul'

register('./ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const { matchAskFlow } = await import('../../src/utils/officeAsk.ts')

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
let seed = opt('--seed', 1)
const show = opt('--show', 15)
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}

const UNSHIFT = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ', ㅒ: 'ㅐ', ㅖ: 'ㅔ' }
const ROWS = ['ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ', 'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ', 'ㅋㅌㅊㅍㅠㅜㅡ']
const VOWELS = new Set('ㅛㅕㅑㅐㅔㅗㅓㅏㅣㅠㅜㅡ')
function neighbors(ch) {
  for (const row of ROWS) {
    const i = row.indexOf(ch)
    if (i < 0) continue
    return [row[i - 1], row[i + 1]].filter((x) => x && VOWELS.has(x) === VOWELS.has(ch))
  }
  return []
}
const syllables = (q) => Array.from(q).map((ch, i) => ({ ch, i })).filter(({ ch }) => /[가-힣]/.test(ch))
const replaceAt = (q, i, ch) => {
  const chars = Array.from(q)
  chars[i] = ch
  return chars.join('')
}
const pick = (list) => list[Math.floor(random() * list.length)]

function make(kind, q) {
  const options = []
  for (const { ch, i } of syllables(q)) {
    const p = disassembleCompleteCharacter(ch)
    if (!p) continue
    const { choseong: c, jungseong: v, jongseong: t } = p
    try {
      if (kind === 'shift') {
        if (UNSHIFT[c]) options.push(replaceAt(q, i, combineCharacter(UNSHIFT[c], v, t)))
        if (UNSHIFT[v]) options.push(replaceAt(q, i, combineCharacter(c, UNSHIFT[v], t)))
        if (UNSHIFT[t]) options.push(replaceAt(q, i, combineCharacter(c, v, UNSHIFT[t])))
      } else if (kind === 'near') {
        for (const c2 of neighbors(c)) if (c2 !== 'ㅃ') options.push(replaceAt(q, i, combineCharacter(c2, v, t)))
        for (const v2 of neighbors(v)) options.push(replaceAt(q, i, combineCharacter(c, v2, t)))
      } else if (kind === 'batchim' && t) {
        options.push(replaceAt(q, i, combineCharacter(c, v, '')))
      }
    } catch {
      // 받침이 될 수 없는 자음 등
    }
  }
  return options.length ? pick(options) : null
}

const dir = new URL('./cases/', import.meta.url)
const route = (hit) => (hit ? `${hit.flow.id}/${hit.nodeId}` : 'none')
const ok = (got, expect) => (expect.includes('/') || expect === 'none' ? got === expect : got.split('/')[0] === expect)
const stats = {}
const broke = []
const fixed = []
for (const file of readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
  for (const { q, expect } of JSON.parse(readFileSync(new URL(file, dir), 'utf8'))) {
    for (const kind of ['shift', 'near', 'batchim']) {
      const typo = make(kind, q)
      if (!typo) continue
      const key = `${kind}${expect === 'none' ? '(none)' : ''}`
      const s = (stats[key] ??= { n: 0, before: 0, after: 0, broke: 0 })
      const before = ok(route(matchAskFlow(typo, undefined, { typos: false })), expect)
      const gotAfter = route(matchAskFlow(typo))
      const after = ok(gotAfter, expect)
      s.n += 1
      s.before += before ? 1 : 0
      s.after += after ? 1 : 0
      if (before && !after) {
        s.broke += 1
        broke.push(`망침 ${kind}  "${typo}" (원문 "${q}")  기대 ${expect} → ${gotAfter}`)
      } else if (!before && after) fixed.push(`고침 ${kind}  "${typo}" → ${gotAfter}`)
    }
  }
}
const pct = (a, n) => `${((100 * a) / n).toFixed(1)}%`
console.log('종류            문항    교정 전   교정 후   교정이 망친 수')
for (const [key, s] of Object.entries(stats)) {
  console.log(`${key.padEnd(15)} ${String(s.n).padStart(5)}   ${pct(s.before, s.n).padStart(6)}   ${pct(s.after, s.n).padStart(6)}   ${s.broke}`)
}
console.log('')
for (const line of broke.slice(0, show)) console.log(line)
for (const line of fixed.slice(0, show)) console.log(line)
