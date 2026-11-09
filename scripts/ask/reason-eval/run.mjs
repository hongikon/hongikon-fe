// 정답표(cases-reason/*.json)를 로컬 서버 /ask/route 에 보내 답을 모은다.
// 사용: ASK_DEV_KEY=... node run.mjs <label> [base] [--cases reason|place] [--runs 3]
//  - 결과: answers-<label>.json(1회) 또는 answers-<label>-r1.json … (여러 번 — 흔들림을 재려고, docs/ask-reasoning-eval.md 6절)
//  - 답 글자 말고도 앱 조작(actions)·위치(facilityId)·근거(nodeIds·references)를 남긴다 — check.mjs 가 구조를 채점한다.
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
const [label, base = 'http://localhost:8081'] = positional
const caseSet = flag('cases', 'reason')
const runs = Number(flag('runs', '1'))
if (!label) {
  console.error('사용: ASK_DEV_KEY=... node run.mjs <label> [base] [--cases reason|place] [--runs 3]')
  process.exit(1)
}
const cases = JSON.parse(readFileSync(new URL(`../cases-reason/${caseSet}.json`, import.meta.url), 'utf8'))
const KEY = process.env.ASK_DEV_KEY

async function ask(c, run) {
  const started = Date.now()
  try {
    const res = await fetch(`${base}/ask/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ask-Dev-Key': KEY },
      body: JSON.stringify({ question: c.q, conversationId: `reason-${label}-${run}-${c.id}` }),
      signal: AbortSignal.timeout(300_000),
    })
    const body = res.ok ? await res.json() : await res.text()
    return { ok: res.ok, status: res.status, body, ms: Date.now() - started }
  } catch (e) {
    return { ok: false, status: 0, body: String(e), ms: Date.now() - started }
  }
}

const shownText = (b) =>
  [b?.answer ?? '', ...(b?.sections ?? []).flatMap((s) => [`[${s.title}]`, ...s.items, ...(s.table ? [s.table.head.join(' | '), ...s.table.rows.map((r) => r.join(' | '))] : [])])].join('\n')

async function once(run) {
  const out = []
  let next = 0
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < cases.length) {
      const c = cases[next++]
      const r = await ask(c, run)
      const b = r.ok ? r.body : null
      out.push({
        id: c.id, ok: r.ok, status: r.status, ms: r.ms, found: b?.found, nodeIds: b?.nodeIds,
        actions: (b?.actions ?? []).map((a) => ({ type: a.type, target: a.target })), facilityId: b?.facilityId ?? null,
        references: (b?.references ?? []).map((x) => x.title),
        tableRows: (b?.sections ?? []).reduce((n, s) => n + (s.table?.rows.length ?? 0), 0),
        text: r.ok ? shownText(b) : String(r.body).slice(0, 300),
      })
      process.stdout.write(`${c.id}:${r.ok ? 'ok' : r.status} `)
    }
  }))
  out.sort((a, b) => a.id.localeCompare(b.id))
  const file = runs > 1 ? `answers-${label}-r${run}.json` : `answers-${label}.json`
  writeFileSync(file, JSON.stringify(out, null, 1))
  const okCount = out.filter((o) => o.ok).length
  console.log(`\n${file}: ${okCount}/${out.length} ok, median ${out.map((o) => o.ms).sort((a, b) => a - b)[out.length >> 1]}ms`)
  if (okCount < out.length / 2) {
    console.log('TOO MANY ERRORS', out.find((o) => !o.ok)?.text)
    process.exit(1)
  }
}

for (let run = 1; run <= runs; run++) await once(run)
