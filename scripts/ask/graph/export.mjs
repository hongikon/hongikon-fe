// 사람이 확인한(reviewed 가 채워진) 선만 백엔드 규정 그래프로 내보낸다.
// 사용: node scripts/ask/graph/export.mjs <출력 rule-graph.json> [--candidates 후보 JSON] [--be 백엔드 ask 폴더] [--version 2026-10-30.1]
// 출력은 보통 백엔드 src/main/resources/ask/rule-graph.json. catalogVersion 은 지금 catalog.json 의 version 이다.
// 내보내기 전에 validate 와 같은 검사를 하고, 오류가 하나라도 있으면(미확인 선의 오류도) 쓰지 않는다.
// 점은 확인된 선이 닿는 것만 넣는다(서버는 선이 없는 점을 쓰지 않는다).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_BE_ASK_DIR, DEFAULT_CANDIDATES, isReviewed, parseArgs, readJson, validate } from './lib.mjs'

const { flags, rest } = parseArgs(process.argv.slice(2))
const outPath = rest[0]
if (!outPath) {
  console.error('출력 경로가 없다. 예: node scripts/ask/graph/export.mjs ../hongikon-be/src/main/resources/ask/rule-graph.json')
  process.exit(2)
}
const beDir = flags.be ?? DEFAULT_BE_ASK_DIR
const graph = readJson(flags.candidates ?? DEFAULT_CANDIDATES)
const catalog = readJson(join(beDir, 'catalog.json'))
const { version: sourcesVersion, sources } = readJson(join(beDir, 'sources.json'))
if (catalog.version !== sourcesVersion) {
  console.error(`catalog.json(${catalog.version})과 sources.json(${sourcesVersion}) version 이 다르다 — export-catalog 를 다시 돌린다`)
  process.exit(1)
}

const { errors } = validate(graph, sources)
if (errors.length) {
  for (const error of errors) console.error(`오류  ${error}`)
  console.error(`오류 ${errors.length}개 — 내보내지 않는다(validate.mjs 로 확인)`)
  process.exit(1)
}

const edges = graph.edges.filter(isReviewed).map(({ id, from, to, type, fact, guide, quote, condition, reviewed }) => ({
  id, from, to, type, fact, guide, quote, condition: condition ?? null, reviewed,
}))
const used = new Set(edges.flatMap((edge) => [edge.from, edge.to]))
const nodes = graph.nodes.filter((node) => used.has(node.id)).map(({ id, name, guides }) => ({ id, name, guides }))

const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
const out = { version: flags.version ?? `${today}.1`, catalogVersion: catalog.version, nodes, edges }
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`)
console.log(`확인된 선 ${edges.length}/${graph.edges.length}개, 점 ${nodes.length}개 → ${outPath} (catalog ${catalog.version})`)
