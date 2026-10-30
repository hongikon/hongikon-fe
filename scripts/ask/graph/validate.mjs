// 규정 그래프 후보 검사. 사용: node scripts/ask/graph/validate.mjs [후보 JSON] [--be 백엔드 ask 폴더]
// 기본 후보는 옆의 candidates.json, 원문은 백엔드 src/main/resources/ask/sources.json(export-catalog.mjs 가 쓰는 곳).
// 검사: guide 가 sources.json 에 있나, quote 가 그 안내 원문에 글자 그대로 있나, 같은 선 중복, 어느 선에도 안 닿는 점,
//       선 종류(결과·선행조건·예외·제한·기간), condition 칸 이름, reviewed 형식("" 또는 "YYYY-MM-DD 사람").
// export-catalog 로 sources.json 이 바뀌면 다시 돌린다 — quote 가 깨진 선은 재검토 목록이다. 오류가 있으면 1 로 끝난다.
import { join } from 'node:path'
import { DEFAULT_BE_ASK_DIR, DEFAULT_CANDIDATES, isReviewed, parseArgs, readJson, validate } from './lib.mjs'

const { flags, rest } = parseArgs(process.argv.slice(2))
const candidatesPath = rest[0] ?? DEFAULT_CANDIDATES
const beDir = flags.be ?? DEFAULT_BE_ASK_DIR

const graph = readJson(candidatesPath)
const { version, sources } = readJson(join(beDir, 'sources.json'))
const { errors, warnings } = validate(graph, sources)

if (graph.catalogVersion && graph.catalogVersion !== version) {
  warnings.unshift(`후보를 만든 카탈로그(${graph.catalogVersion})와 지금 sources.json(${version})이 다르다 — quote 오류가 없으면 그대로 써도 된다`)
}

const reviewed = graph.edges.filter(isReviewed).length
console.log(`점 ${graph.nodes.length}개, 선 ${graph.edges.length}개(확인됨 ${reviewed}, 미확인 ${graph.edges.length - reviewed}) · sources ${version}`)
for (const warning of warnings) console.log(`경고  ${warning}`)
for (const error of errors) console.log(`오류  ${error}`)
console.log(errors.length ? `오류 ${errors.length}개` : '통과')
process.exit(errors.length ? 1 : 0)
