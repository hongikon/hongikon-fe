// 돈 안 드는 기계 채점(11-09) — LLM 채점(judge.mjs, Opus) 전에 매번 돌리는 회귀 검사.
// 사용: node check.mjs <cases> <answers-파일…>   예: node check.mjs place answers-haiku-base-r1.json answers-haiku-graph-r1.json
//
// 문항 칸(cases-reason/*.json):
//   must:    [[낱말…], …]  — 묶음마다 하나라도 답에 있어야 한다(띄어쓰기·대소문자 무시)
//   mustNot: [낱말…]      — 하나라도 있으면 손해 오류 후보
//   actions: ['map','route'] | []  — 답의 앱 조작 종류(순서 무관). 빈 배열이면 지도·가는 길 버튼이 없어야 한다(위치 카드 facilityId 도 없어야)
//   minTableRows: n       — 표 행 합이 n 이상(교수진·목록 전부)
// 결과: 파일마다 must 묶음 포함률·mustNot 위반·구조 통과, 그리고 문항별 표(틀린 칸만).
import { readFileSync } from 'node:fs'

const [caseSet, ...files] = process.argv.slice(2)
if (!caseSet || files.length === 0) {
  console.error('사용: node check.mjs <reason|place> <answers-…json> [...]')
  process.exit(1)
}
const cases = JSON.parse(readFileSync(new URL(`../cases-reason/${caseSet}.json`, import.meta.url), 'utf8'))
const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '')

function grade(c, a) {
  const text = norm(a?.text)
  const misses = []
  const must = c.must ?? []
  const hit = must.filter((group) => group.some((w) => text.includes(norm(w))))
  if (hit.length < must.length) misses.push(`must ${hit.length}/${must.length}`)
  const bad = (c.mustNot ?? []).filter((w) => text.includes(norm(w)))
  if (bad.length) misses.push(`mustNot: ${bad.join(', ')}`)
  let structureOk = true
  if (Array.isArray(c.actions)) {
    const got = [...new Set((a?.actions ?? []).map((x) => x.type))].sort().join(',')
    const want = [...new Set(c.actions)].sort().join(',')
    const placeCard = c.actions.length === 0 && a?.facilityId
    if (got !== want || placeCard) {
      structureOk = false
      misses.push(`actions [${got}] ≠ [${want}]${placeCard ? ' + 위치카드' : ''}`)
    }
  }
  if (c.minTableRows && (a?.tableRows ?? 0) < c.minTableRows) {
    structureOk = false
    misses.push(`표 ${a?.tableRows ?? 0}행 < ${c.minTableRows}`)
  }
  return { ok: !!a?.ok, mustHit: hit.length, mustAll: must.length, bad: bad.length, structureOk: structureOk && !!a?.ok, misses }
}

const rows = []
for (const file of files) {
  const answers = new Map(JSON.parse(readFileSync(file, 'utf8')).map((a) => [a.id, a]))
  let mustHit = 0, mustAll = 0, bad = 0, structOk = 0, structAll = 0, failed = 0
  const wrong = []
  for (const c of cases) {
    const g = grade(c, answers.get(c.id))
    if (!g.ok) failed++
    mustHit += g.mustHit
    mustAll += g.mustAll
    bad += g.bad
    if (Array.isArray(c.actions) || c.minTableRows) {
      structAll++
      if (g.structureOk) structOk++
    }
    if (g.misses.length || !g.ok) wrong.push(`  ${c.id} ${g.ok ? '' : '(실패) '}${g.misses.join(' · ')}  — ${c.q}`)
  }
  rows.push({ file, mustRate: mustAll ? mustHit / mustAll : 1, bad, struct: structAll ? `${structOk}/${structAll}` : '-', failed })
  console.log(`\n## ${file}`)
  console.log(wrong.length ? wrong.join('\n') : '  모두 통과')
}
console.log('\n| 파일 | must 포함률 | mustNot 위반 | 구조 통과 | 답 실패 |\n|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.file} | ${(r.mustRate * 100).toFixed(0)}% | ${r.bad} | ${r.struct} | ${r.failed} |`)
