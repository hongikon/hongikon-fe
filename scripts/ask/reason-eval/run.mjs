// 추론 정답표(reason.json)를 로컬 서버 /ask/route 에 보내 답을 모은다.
// 사용: ASK_DEV_KEY=... node run.mjs <label> [base]
import { readFileSync, writeFileSync } from 'node:fs'

const [label, base = 'http://localhost:8081'] = process.argv.slice(2)
const cases = JSON.parse(readFileSync(new URL('../cases-reason/reason.json', import.meta.url), 'utf8'))
const KEY = process.env.ASK_DEV_KEY

async function ask(c) {
  const started = Date.now()
  try {
    const res = await fetch(`${base}/ask/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ask-Dev-Key': KEY },
      body: JSON.stringify({ question: c.q, conversationId: `reason-${label}-${c.id}` }),
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

const out = []
let next = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < cases.length) {
    const c = cases[next++]
    const r = await ask(c)
    out.push({ id: c.id, ok: r.ok, status: r.status, ms: r.ms, found: r.body?.found, nodeIds: r.body?.nodeIds, text: r.ok ? shownText(r.body) : String(r.body).slice(0, 300) })
    process.stdout.write(`${c.id}:${r.ok ? 'ok' : r.status} `)
  }
}))
out.sort((a, b) => a.id.localeCompare(b.id))
writeFileSync(`answers-${label}.json`, JSON.stringify(out, null, 1))
console.log(`\n${label}: ${out.filter((o) => o.ok).length}/${out.length} ok, median ${out.map((o) => o.ms).sort((a, b) => a - b)[out.length >> 1]}ms`)
if (out.filter((o) => o.ok).length < out.length / 2) { console.log("TOO MANY ERRORS", out.find((o) => !o.ok)?.text); process.exit(1) }
