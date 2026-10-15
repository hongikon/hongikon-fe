// 질문 → 흐름/단계 정답표(cases/*.json)로 물어보기 경로를 검사한다. 사용: node scripts/ask/test-routing.mjs [낱말로 거르기]
// 정답 형식: { "q": "와이파이 연결 방법", "expect": "wifi" | "wifi/ios" | "none" }  ("none" = 안내 흐름 없이 부서 찾기로 가야 함)
import { register } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'

register('./ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const { matchAskFlow } = await import('../../src/utils/officeAsk.ts')

const dir = new URL('./cases/', import.meta.url)
const filter = process.argv[2]
let pass = 0
const fails = []
for (const file of readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
  for (const { q, expect } of JSON.parse(readFileSync(new URL(file, dir), 'utf8'))) {
    if (filter && !q.includes(filter) && !expect.includes(filter)) continue
    const hit = matchAskFlow(q)
    const got = hit ? `${hit.flow.id}/${hit.nodeId}` : 'none'
    const ok = expect.includes('/') || expect === 'none' ? got === expect : got.split('/')[0] === expect
    if (ok) pass += 1
    else fails.push(`${file}  "${q}"  기대 ${expect}  →  실제 ${got}`)
  }
}
for (const line of fails) console.log('✗', line)
console.log(`\n${pass}/${pass + fails.length} 통과`)
process.exit(fails.length ? 1 : 0)
