import type { PathEdge, PathWaypoint } from '../types'

/**
 * 경로망 현장 조사 초안 — 개발용 `/dev/path-survey` 화면이 쓴다.
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

export const EMPTY_DRAFT: SurveyDraft = { nodes: [], edges: [], memos: {} }

const STORAGE_KEY = 'hongikon.pathSurvey.v1'

/** 웹에서만 localStorage 로 자동 저장한다(탭을 닫아도 조사 내용이 남도록). 앱(WebView 밖 네이티브)에서는 건너뛴다. */
export function loadDraft(): SurveyDraft {
  try {
    const raw = (globalThis as any).localStorage?.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_DRAFT
    const parsed = JSON.parse(raw)
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      memos: parsed.memos && typeof parsed.memos === 'object' ? parsed.memos : {},
    }
  } catch {
    return EMPTY_DRAFT
  }
}

export function saveDraft(draft: SurveyDraft): void {
  try {
    ;(globalThis as any).localStorage?.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // 저장 공간이 없거나 막혀 있으면 조용히 넘어간다.
  }
}

/** 기존 지점과 새 지점 모두에서 가장 큰 n번호 + 1. */
export function nextNodeId(existing: readonly PathWaypoint[], added: readonly PathWaypoint[]): string {
  let max = 0
  for (const w of [...existing, ...added]) {
    const m = /^n(\d+)$/.exec(w.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `n${max + 1}`
}

export const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

export const hasEdge = (edges: readonly PathEdge[], a: string, b: string) => {
  const key = edgeKey(a, b)
  return edges.some(([x, y]) => edgeKey(x, y) === key)
}

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
