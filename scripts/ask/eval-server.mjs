// 정답표(cases/*.json)에서 표본을 뽑아 서버 물어보기(POST /ask/route)에 보내고, 실패를 종류별로 센다.
// 사용: ASK_DEV_KEY=... node scripts/ask/eval-server.mjs [--n 300] [--seed 1] [--base http://localhost:8080] [--concurrency 3] [--limit 5] [--scope-only] [--criteria-only]
// 로컬 서버(local 프로필)용이다 — 질문마다 LLM 을 부르니 운영 서버에 돌리지 않는다.
// 범위 정답표(cases-scope/*.json)는 표본으로 뽑지 않고 매번 전부 돈다 — 거절·섞임은 하나라도 틀리면 안 된다.
// 기준 정답표(cases-criteria/*.json)도 매번 전부 돈다 — must 의 낱말 묶음마다 하나는 답에 있어야 한다(몇 과목·몇 학점·마감 같은 조건).
// 결과: cache/eval/<시각>/results.jsonl · summary.md (cache/ 는 git 에 안 올림)
import { register } from 'node:module'
import { mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'

register('./ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const { matchAskFlow } = await import('../../src/utils/officeAsk.ts')

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
)
const N = Number(args.n ?? 300)
const SEED = Number(args.seed ?? 1)
const BASE = args.base ?? 'http://localhost:8080'
const CONCURRENCY = Number(args.concurrency ?? 3)
const KEY = process.env.ASK_DEV_KEY
if (!KEY) {
  console.error('ASK_DEV_KEY 가 없다(서버 ask.dev-key-sha256 에 맞는 평문 키).')
  process.exit(2)
}

// 되묻기 단계 id — 서버가 답 없이 버튼으로 되묻는 노드.
const catalog = JSON.parse(readFileSync(new URL('../../../hongikon-be/src/main/resources/ask/catalog.json', import.meta.url), 'utf8'))
const questionNodes = new Set(catalog.entries.filter((e) => e.kind === 'question').map((e) => e.id))

// 거절 문구와 다른 대학 이름은 서버 코드에서 읽는다(한 곳에서만 고치게) — docs/ask-scope-policy.md.
const askDir = new URL('../../../hongikon-be/src/main/java/com/hongmap/hongmapbackend/ask/', import.meta.url)
const scopeSource = readFileSync(new URL('AskScope.java', askDir), 'utf8')
const refusals = Object.fromEntries([...scopeSource.matchAll(/^\s{4}([A-Z_]+)\("([^"]+)"\)/gm)].map(([, name, text]) => [text, name.toLowerCase()]))
const guardSource = readFileSync(new URL('OtherSchoolGuard.java', askDir), 'utf8')
const schoolNames = [...guardSource.slice(guardSource.indexOf('NAMES = List.of('), guardSource.indexOf(');', guardSource.indexOf('NAMES = List.of('))).matchAll(/"([^"]+)"/g)].map((m) => m[1])
const notSchoolAfter = /^(입구|공원|왕|장경|회)/
/** 답에 나온 다른 대학 이름(검토용 — 근거 원문에 있어 통과한 것인지 사람이 본다). */
function otherSchoolsIn(text) {
  const lower = text.toLowerCase()
  return schoolNames.filter((name) => {
    let from = 0
    for (;;) {
      const at = lower.indexOf(name.toLowerCase(), from)
      if (at < 0) return false
      if (!notSchoolAfter.test(text.slice(at + name.length, at + name.length + 3))) return true
      from = at + 1
    }
  })
}

/** 기준 정답표: 낱말 묶음마다 하나도 답에 없으면 그 묶음을 돌려준다(띄어쓰기는 무시). */
function missingMust(must, text) {
  if (!must) return undefined
  const flat = text.replace(/\s+/g, '')
  return must.filter((group) => !group.some((word) => flat.includes(word.replace(/\s+/g, ''))))
}

/** 같은 seed 면 같은 표본(재실행해 고치기 전후를 비교한다). */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 파일마다 크기에 비례해 뽑고, 작은 파일도 3개는 넣는다.
const dir = new URL('./cases/', import.meta.url)
const files = readdirSync(dir).filter((name) => name.endsWith('.json')).sort()
const all = files.map((file) => ({ file, cases: JSON.parse(readFileSync(new URL(file, dir), 'utf8')) }))
const total = all.reduce((sum, f) => sum + f.cases.length, 0)
const random = rng(SEED)
const sample = []
for (const { file, cases } of all) {
  const take = Math.min(cases.length, Math.max(3, Math.round((cases.length / total) * N)))
  const pool = [...cases]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  for (const c of pool.slice(0, take)) sample.push({ file, ...c })
}
// --limit: 스크립트 시험용으로 앞에서 몇 문항만. --scope-only: 범위 정답표만(범위 규칙만 고쳤을 때).
if (args.limit) sample.splice(Number(args.limit))
if ('scope-only' in args || 'criteria-only' in args) sample.splice(0)
const scopeDir = new URL('./cases-scope/', import.meta.url)
if (!args.limit) {
  if (!('criteria-only' in args)) {
    for (const file of readdirSync(scopeDir).filter((name) => name.endsWith('.json')).sort()) {
      for (const c of JSON.parse(readFileSync(new URL(file, scopeDir), 'utf8'))) sample.push({ file: `scope/${file}`, ...c })
    }
  }
  if (!('scope-only' in args)) {
    const criteriaDir = new URL('./cases-criteria/', import.meta.url)
    for (const file of readdirSync(criteriaDir).filter((name) => name.endsWith('.json')).sort()) {
      for (const c of JSON.parse(readFileSync(new URL(file, criteriaDir), 'utf8'))) sample.push({ file: `criteria/${file}`, ...c })
    }
  }
}

/** 정답이 흐름만 적혀 있으면 그 흐름의 아무 단계나 맞은 것으로 본다(test-routing.mjs 와 같은 규칙). */
const matches = (expect, id) => (expect.includes('/') ? id === expect : id.split('/')[0] === expect)

/**
 * 실패 종류:
 *  OK            맞는 안내로 답했거나(expect none 이면 none)
 *  CLARIFY       맞는 흐름의 되묻기 단계라 답 없이 버튼
 *  PICK_MISS     정답 안내가 근거에 없음(찾기·고르기 실패) — 다르지만 맞는 안내일 수 있어 사람이 본다
 *  RIGHT_NOT_FOUND 정답 안내를 골랐는데 '확인되지 않아요'(안내에 정보가 없거나 답 쓰기 문제)
 *  NONE_ANSWERED 정답은 none 인데 답함(도구로 찾았을 수 있어 사람이 본다)
 *  NO_ANSWER     답도 되묻기도 아닌데 answer 없음(답 쓰기 실패)
 *  ERROR         HTTP 오류
 * 범위 정답표(expect 'out:<범위>' · 'school' · 흐름):
 *  SCOPE_OK      범위 밖 질문을 거절함
 *  UNDER_BLOCK   범위 밖 질문에 답함(거절 못 함)
 *  OVER_BLOCK    학교 질문을 거절함
 *  MIX_BLOCKED   학교 질문인데 출구 검사가 다른 대학 이름 때문에 답을 버림(근거 원문 확인 필요)
 */
/** 거절했는지 — 새 서버는 고정 문구, 옛 서버는 none·found=false 로 본다(기준 평가와 비교하려고). */
const refusedAs = (body) => refusals[body.answer] ?? (body.nodeId === 'none' && body.found === false && !(body.nodeIds ?? []).length ? 'refused' : null)

function classify(c, res) {
  if (!res.ok) return 'ERROR'
  const { nodeId, nodeIds = [], answer, found } = res.body
  const refused = refusedAs(res.body)
  if (c.expect.startsWith('out:')) return refused ? 'SCOPE_OK' : 'UNDER_BLOCK'
  if (refused === 'other_school') return 'MIX_BLOCKED'
  if (refused && refused !== 'refused') return 'OVER_BLOCK'
  if (c.expect === 'school') return answer ? 'OK' : 'NO_ANSWER'
  const ids = nodeIds.length ? nodeIds : [nodeId]
  if (c.expect === 'none') {
    if (nodeId === 'none' && !answer) return 'OK'
    return answer && found ? 'NONE_ANSWERED' : 'OK'
  }
  const hit = ids.some((id) => id && matches(c.expect, id))
  if (!hit) return 'PICK_MISS'
  if (!answer) return questionNodes.has(nodeId) ? 'CLARIFY' : 'NO_ANSWER'
  return found ? 'OK' : 'RIGHT_NOT_FOUND'
}

async function ask(c) {
  // 앱처럼 낱말 찾기 결과를 hint 로 넘긴다.
  const local = matchAskFlow(c.q)
  const hint = local ? `${local.flow.id}/${local.nodeId}` : undefined
  const started = Date.now()
  try {
    const response = await fetch(`${BASE}/ask/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ask-Dev-Key': KEY },
      body: JSON.stringify({ question: c.q, hint, conversationId: `eval-${SEED}-${sample.indexOf(c)}` }),
    })
    const body = response.ok ? await response.json() : await response.text()
    return { ok: response.ok, status: response.status, body, ms: Date.now() - started, hint }
  } catch (error) {
    return { ok: false, status: 0, body: String(error), ms: Date.now() - started, hint }
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = new URL(`./cache/eval/${stamp}/`, import.meta.url)
mkdirSync(outDir, { recursive: true })
const resultsFile = new URL('results.jsonl', outDir)
writeFileSync(resultsFile, '')

console.log(`표본 ${sample.length}문항(전체 ${total}, seed ${SEED}) → ${BASE}`)
const results = []
let next = 0
async function worker() {
  while (next < sample.length) {
    const c = sample[next++]
    const res = await ask(c)
    const kind = classify(c, res)
    const sections = res.body?.sections ?? []
    const shown = [res.body?.answer ?? '', ...sections.flatMap((s) => [s.title, ...s.items, ...(s.table ? [s.table.head.join(' '), ...s.table.rows.map((r) => r.join(' '))] : [])])].join('\n')
    const row = {
      file: c.file, q: c.q, expect: c.expect, kind, hint: res.hint, status: res.status, ms: res.ms,
      chars: shown.length, sectionCount: sections.length, tables: sections.filter((s) => s.table).length,
      otherSchools: otherSchoolsIn(shown),
      mustMissing: missingMust(c.must, shown),
      nodeId: res.body?.nodeId, nodeIds: res.body?.nodeIds, found: res.body?.found, answer: res.body?.answer ?? null, sections,
      references: res.body?.references?.map((r) => r.title), error: res.ok ? undefined : String(res.body).slice(0, 300),
    }
    results.push(row)
    appendFileSync(resultsFile, `${JSON.stringify(row)}\n`)
    process.stdout.write(`\r${results.length}/${sample.length}`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
console.log()

const count = (rows) => rows.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {})
const kinds = ['OK', 'CLARIFY', 'PICK_MISS', 'RIGHT_NOT_FOUND', 'NONE_ANSWERED', 'NO_ANSWER', 'SCOPE_OK', 'UNDER_BLOCK', 'OVER_BLOCK', 'MIX_BLOCKED', 'ERROR']
const overall = count(results)
const ms = results.map((r) => r.ms).sort((a, b) => a - b)
/** 백분위(0.5 = 중앙값). */
const pct = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0
}
const answered = results.filter((r) => r.answer && !refusedAs({ answer: r.answer, nodeId: r.nodeId, found: r.found, nodeIds: r.nodeIds }))
const scopeRows = results.filter((r) => r.file.startsWith('scope/'))
const mixRows = results.filter((r) => r.otherSchools.length && r.answer)
const criteriaRows = results.filter((r) => r.file.startsWith('criteria/'))
const criteriaFull = criteriaRows.filter((r) => r.answer && !r.mustMissing?.length)
const lines = [
  `# 물어보기 서버 평가 ${stamp}`,
  '',
  `표본 ${results.length}문항 / 전체 ${total} · seed ${SEED} · 카탈로그 ${results.find((r) => r.status === 200) ? '' : '(응답 없음)'}`,
  `지연 중앙 ${ms[Math.floor(ms.length / 2)]}ms · 90% ${ms[Math.floor(ms.length * 0.9)]}ms`,
  `답 길이(요약+목록+표 글자) 중앙 ${pct(answered.map((r) => r.chars), 0.5)}자 · 90% ${pct(answered.map((r) => r.chars), 0.9)}자 · 섹션 평균 ${(answered.reduce((n, r) => n + r.sectionCount, 0) / Math.max(1, answered.length)).toFixed(1)} · 표가 있는 답 ${answered.filter((r) => r.tables).length}건`,
  `범위 정답표 ${scopeRows.length}문항: 거절 맞음 ${scopeRows.filter((r) => r.kind === 'SCOPE_OK').length} · 거절 못 함 ${scopeRows.filter((r) => r.kind === 'UNDER_BLOCK').length} · 학교 질문 잘못 거절 ${results.filter((r) => r.kind === 'OVER_BLOCK').length} · 섞임 차단 ${results.filter((r) => r.kind === 'MIX_BLOCKED').length}`,
  `기준 정답표 ${criteriaRows.length}문항: 핵심 조건 다 담음 ${criteriaFull.length} · 빠짐 ${criteriaRows.length - criteriaFull.length}`,
  `다른 대학 이름이 든 답 ${mixRows.length}건(근거 원문에 있는 언급인지 아래 목록으로 확인)`,
  '',
  '| 종류 | 건수 | 비율 |',
  '|---|---|---|',
  ...kinds.map((k) => `| ${k} | ${overall[k] ?? 0} | ${(((overall[k] ?? 0) / results.length) * 100).toFixed(1)}% |`),
  '',
  '## 파일별',
  '',
  `| 파일 | 표본 | ${kinds.join(' | ')} |`,
  `|---|---|${kinds.map(() => '---').join('|')}|`,
  ...files
    .map((file) => [file, results.filter((r) => r.file === file)])
    .filter(([, rows]) => rows.length)
    .map(([file, rows]) => {
      const c = count(rows)
      return `| ${file} | ${rows.length} | ${kinds.map((k) => c[k] ?? 0).join(' | ')} |`
    }),
]
lines.push('', '## 다른 대학 이름이 든 답', '', ...mixRows.map((r) => `- [${r.kind}] ${r.q} → ${r.otherSchools.join(', ')} · ${r.answer.slice(0, 120).replace(/\n/g, ' ')}`))
lines.push('', '## 범위 정답표 결과', '', ...scopeRows.map((r) => `- [${r.kind}] (${r.expect}) ${r.q} → ${(r.answer ?? '-').slice(0, 80).replace(/\n/g, ' ')}`))
lines.push('', '## 기준 정답표 결과', '', ...criteriaRows.map((r) => `- [${r.kind}${r.mustMissing?.length ? ' 빠짐: ' + r.mustMissing.map((g) => g.join('/')).join(', ') : ''}] ${r.q} → ${(r.answer ?? '-').slice(0, 100).replace(/\n/g, ' ')}`))
writeFileSync(new URL('summary.md', outDir), `${lines.join('\n')}\n`)
console.log(lines.slice(0, 15).join('\n'))
console.log(`\n결과: ${outDir.pathname}`)
