// 규정 그래프 후보(candidates.json) 검사 — validate.mjs 와 export.mjs 가 같이 쓴다. 설계: 백엔드 docs/ask-rule-graph-plan.md 4·6절.
// 서버(AskRuleGraph)가 불러올 때 버리는 선을 여기서 미리 잡는다. 형식이 바뀌면 AskRuleGraph 와 같이 고친다.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** 옆 백엔드 레포의 물어보기 자료 폴더(export-catalog.mjs 기본 출력과 같다). --be 로 바꾼다. */
export const DEFAULT_BE_ASK_DIR = fileURLToPath(new URL('../../../../hongikon-be/src/main/resources/ask/', import.meta.url))
export const DEFAULT_CANDIDATES = fileURLToPath(new URL('./candidates.json', import.meta.url))

/** 선 종류(4절). */
export const TYPES = ['결과', '선행조건', '예외', '제한', '기간']
/** condition 에 쓸 수 있는 칸 이름(4절). */
export const CONDITION_KEYS = ['학년', '이수학기', '휴학중', '장학생', '분할납부', '군복무', '졸업유예']
/** reviewed: 비었거나 "YYYY-MM-DD 사람". */
const REVIEWED = /^(\d{4})-(\d{2})-(\d{2}) \S.*$/
/** 이보다 짧은 quote 는 근거로 약하다(다른 문장에도 들어갈 수 있다) — 경고만. */
const QUOTE_MIN = 10

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

/** `--이름 값` 꼴 인자와 나머지(위치 인자)를 나눈다. */
export const parseArgs = (argv) => {
  const flags = {}
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i]
    else rest.push(argv[i])
  }
  return { flags, rest }
}

const validDate = (y, m, d) => {
  const date = new Date(Date.UTC(+y, +m - 1, +d))
  return date.getUTCFullYear() === +y && date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d
}

export const isReviewed = (edge) => typeof edge.reviewed === 'string' && edge.reviewed.trim() !== ''

/**
 * 그래프를 sources.json 원문에 대조한다. errors 가 하나라도 있으면 내보내지 않는다.
 * @param graph   { nodes, edges } (candidates.json)
 * @param sources sources.json 의 sources(안내 id → 원문)
 */
export const validate = (graph, sources) => {
  const errors = []
  const warnings = []
  const nodes = new Map()

  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return { errors: ['nodes·edges 가 배열이 아니다'], warnings }
  }

  for (const [index, node] of graph.nodes.entries()) {
    const at = `점 ${node.id ?? `#${index}`}`
    if (typeof node.id !== 'string' || !node.id) {
      errors.push(`${at}: id 가 없다`)
      continue
    }
    if (nodes.has(node.id)) errors.push(`${at}: id 가 겹친다`)
    nodes.set(node.id, node)
    if (typeof node.name !== 'string' || !node.name.trim()) errors.push(`${at}: name 이 없다`)
    if (!Array.isArray(node.guides) || node.guides.length === 0) errors.push(`${at}: guides 가 비었다`)
    for (const guide of node.guides ?? []) if (!(guide in sources)) errors.push(`${at}: 안내 ${guide} 가 sources.json 에 없다`)
  }

  const ids = new Set()
  const same = new Map()
  const touched = new Set()
  for (const [index, edge] of graph.edges.entries()) {
    const at = `선 ${edge.id ?? `#${index}`}`
    if (typeof edge.id !== 'string' || !edge.id) errors.push(`${at}: id 가 없다`)
    else if (ids.has(edge.id)) errors.push(`${at}: id 가 겹친다`)
    else ids.add(edge.id)

    for (const end of ['from', 'to']) {
      if (!nodes.has(edge[end])) errors.push(`${at}: ${end} 점 '${edge[end]}' 이 nodes 에 없다`)
      else touched.add(edge[end])
    }
    if (edge.from === edge.to) errors.push(`${at}: 시작점과 끝점이 같다`)
    if (!TYPES.includes(edge.type)) errors.push(`${at}: 종류 '${edge.type}' 은 ${TYPES.join('·')} 가 아니다`)
    if (typeof edge.fact !== 'string' || !edge.fact.trim()) errors.push(`${at}: fact 가 없다`)

    // 근거: 안내가 sources.json 에 있고, quote 가 그 원문에 글자 그대로 있어야 한다.
    const source = sources[edge.guide]
    if (typeof edge.guide !== 'string' || source === undefined) {
      errors.push(`${at}: 근거 안내 '${edge.guide}' 가 sources.json 에 없다`)
    } else if (typeof edge.quote !== 'string' || !edge.quote.trim()) {
      errors.push(`${at}: quote 가 없다`)
    } else {
      if (!source.includes(edge.quote)) errors.push(`${at}: quote 가 안내 ${edge.guide} 원문에 그대로 없다`)
      if (edge.quote.length < QUOTE_MIN) warnings.push(`${at}: quote 가 ${edge.quote.length}자로 짧다`)
      const ends = [nodes.get(edge.from), nodes.get(edge.to)]
      if (!ends.some((node) => node?.guides?.includes(edge.guide))) {
        warnings.push(`${at}: 근거 안내 ${edge.guide} 가 양 끝 점의 guides 어디에도 없다`)
      }
    }

    if (edge.condition !== null && edge.condition !== undefined) {
      if (typeof edge.condition !== 'object' || Array.isArray(edge.condition)) {
        errors.push(`${at}: condition 은 객체나 null 이어야 한다`)
      } else {
        for (const key of Object.keys(edge.condition)) {
          if (!CONDITION_KEYS.includes(key)) errors.push(`${at}: condition 칸 '${key}' 은 허용 목록(${CONDITION_KEYS.join('·')})에 없다`)
        }
      }
    }

    if (typeof edge.reviewed !== 'string') {
      errors.push(`${at}: reviewed 는 문자열이어야 한다(확인 전에는 "")`)
    } else if (edge.reviewed !== '') {
      const match = REVIEWED.exec(edge.reviewed)
      if (!match) errors.push(`${at}: reviewed '${edge.reviewed}' 는 "YYYY-MM-DD 사람" 꼴이 아니다`)
      else if (!validDate(match[1], match[2], match[3])) errors.push(`${at}: reviewed 날짜 '${edge.reviewed}' 가 없는 날이다`)
    }

    // 같은 선: 같은 두 점·같은 종류를 같은 근거 문장으로 또 이은 것.
    const key = JSON.stringify([edge.from, edge.to, edge.type, edge.quote])
    if (same.has(key)) errors.push(`${at}: 선 ${same.get(key)} 와 같다(두 점·종류·quote)`)
    else same.set(key, edge.id ?? `#${index}`)
  }

  for (const id of nodes.keys()) if (!touched.has(id)) errors.push(`점 ${id}: 어느 선에도 닿지 않는다`)

  return { errors, warnings }
}
