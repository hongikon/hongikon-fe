import type { PathEdge, PathWaypoint } from '../types'

/**
 * 경로망 현장 조사 초안 — 개발용 `/dev/path-survey` 화면이 쓴다. SurveyDraft 는 v1 저장 모양이다(hongikon.pathSurvey.v1).
 * 지금은 모듈 저장소(pathSurveyStore.ts)가 v1 초안을 '미분류' 모듈로 옮길 때와, 모듈을 코드 조각으로 내보낼 때만 쓴다.
 * 결과물은 pathNodes.ts 에 그대로 붙여 넣을 수 있는 코드 조각이다(PATH_WAYPOINTS / PATH_EDGES 와 같은 모양).
 * 곡선 길은 별도 형상 데이터를 두지 않고, 기존처럼 중간 지점(n..)을 더 찍어서 표현한다(routing.ts 를 건드리지 않기 위해).
 */

export interface SurveyDraft {
  /** 이번에 새로 찍은 지점. */
  nodes: PathWaypoint[]
  /** 이번에 새로 이은 간선(양 끝은 새 지점이거나 기존 지점). */
  edges: PathEdge[]
  /** 지점 id → 메모. 기존 지점(n12 등)에도 달 수 있다. */
  memos: Record<string, string>
}

/** v1 저장값(또는 그 모양의 아무 값)을 SurveyDraft 로 푼다. 모양이 틀린 칸은 버린다. */
export function parseV1Draft(parsed: unknown): SurveyDraft {
  const p = parsed && typeof parsed === 'object' ? (parsed as any) : {}
  const isEdge = (e: unknown): e is PathEdge => Array.isArray(e) && e.length === 2 && typeof e[0] === 'string' && typeof e[1] === 'string'
  const isNode = (n: any): n is PathWaypoint =>
    !!n && typeof n.id === 'string' && Number.isFinite(n.lat) && Number.isFinite(n.lng)
  return {
    nodes: Array.isArray(p.nodes) ? p.nodes.filter(isNode) : [],
    edges: Array.isArray(p.edges) ? p.edges.filter(isEdge) : [],
    memos:
      p.memos && typeof p.memos === 'object'
        ? Object.fromEntries(Object.entries(p.memos).filter((e): e is [string, string] => typeof e[1] === 'string'))
        : {},
  }
}

export const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** 소수 7자리(약 1cm)로 맞춘다. pathNodes.ts 의 기존 좌표 자릿수와 같다. */
export const round7 = (n: number) => Math.round(n * 1e7) / 1e7

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** pathNodes.ts 에 붙여 넣을 코드 조각. */
export function formatExport(draft: SurveyDraft): string {
  const out: string[] = []
  const newIds = new Set(draft.nodes.map((n) => n.id))

  if (draft.nodes.length > 0) {
    out.push('// ── PATH_WAYPOINTS 배열 맨 끝에 추가 ──')
    for (const n of draft.nodes) {
      const memo = draft.memos[n.id] ? oneLine(draft.memos[n.id]) : ''
      out.push(`  { id: '${n.id}', lat: ${n.lat.toFixed(7)}, lng: ${n.lng.toFixed(7)} },${memo ? ` // ${memo}` : ''}`)
    }
    out.push('')
  }

  if (draft.edges.length > 0) {
    out.push('// ── PATH_EDGES 배열 맨 끝에 추가 ──')
    for (const [a, b] of draft.edges) out.push(`  ['${a}', '${b}'],`)
    out.push('')
  }

  const oldMemos = Object.entries(draft.memos).filter(([id, memo]) => !newIds.has(id) && memo.trim())
  if (oldMemos.length > 0) {
    out.push('// ── 기존 지점에 단 메모(코드에 넣지 않고 참고용) ──')
    for (const [id, memo] of oldMemos) out.push(`// ${id}: ${oneLine(memo)}`)
    out.push('')
  }

  return out.length > 0 ? out.join('\n') : '// 아직 찍은 지점이 없어요'
}
