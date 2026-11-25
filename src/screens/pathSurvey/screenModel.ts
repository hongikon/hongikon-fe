import { darken, type LoadResult, type SurveyModule, type SurveyStore } from '../../utils/pathSurvey/store'
import { shortId } from './ids'
import { floorKeyOf, type LegacyOverlay } from './legacyOverlay'
import type { LegacyToggles } from './LegacyPanel'

/**
 * v2 경로망 조사 화면(DevPathSurveyScreen)의 상수와 상태 없는 계산. React 를 안 써서 node 테스트가 바로 읽는다
 * (scripts/test/pathsurvey-v2-screen.test.ts).
 */

export type Mode = 'add' | 'link' | 'move'
export type Tab = 'edit' | 'modules' | 'legacy' | 'transfer' | 'sync'

export const MODES: { key: Mode; label: string; help: string }[] = [
  { key: 'add', label: '지점 찍기', help: '지도를 누르면 편집 중인 모듈에 지점이 생겨요. "이어 찍기"를 켜면 직전 지점과 간선까지 같이 만들어요.' },
  { key: 'link', label: '간선 잇기', help: '지점 두 개를 차례로 누르면 간선이 생겨요. 다른 모듈의 특수 지점(엘리베이터, 출입구, 교차점)도 눌러 함께 쓸 수 있어요. 다른 모듈의 일반 지점을 누르면 계단 끝으로 표시해 공유하니, 층이 다른 모듈의 계단 끝끼리 잇고 그 간선을 계단으로 바꾸세요. 이어서 누르면 계속 이어지고, 같은 지점을 다시 누르면 끊겨요. 이미 있는 간선을 또 이으면 지워져요.' },
  { key: 'move', label: '위치 옮기기', help: '편집 중인 모듈의 지점을 끌어서 옮겨요. 특수 지점은 다른 모듈에서도 옮길 수 있고, 참조한 모든 모듈에 반영돼요. 다른 간선 중간에 놓으면 간선 위로 맞추고 두 간선으로 나눠요. 되돌리기로 복구할 수 있어요.' },
]

export const TABS: { key: Tab; label: string }[] = [
  { key: 'edit', label: '편집' },
  { key: 'modules', label: '모듈' },
  { key: 'legacy', label: '기존 자료' },
  { key: 'transfer', label: '내보내기' },
  { key: 'sync', label: '동기화' },
]

/** 화면을 열 때의 첫 안내: 저장 내용을 못 읽었거나, 예전 v1 초안을 옮겼을 때. */
export function bootNotice(boot: Pick<LoadResult, 'corrupt' | 'migrated'>): string {
  if (boot.corrupt) return '저장된 조사 내용(v2)을 읽지 못했어요. 덮어쓰지 않도록 저장을 멈췄어요 — 내보내기 전에 개발자 도구로 값을 확인해 주세요.'
  const r = boot.migrated
  if (!r) return ''
  return `예전 초안(v1)을 '미분류' 모듈로 옮겼어요 · 지점 ${r.nodes}/${r.v1Nodes} · 간선 ${r.edges}/${r.v1Edges} · 메모 ${r.memos}/${r.v1Memos}${
    r.refNodes ? ` · 기존 지점 복사 ${r.refNodes}` : ''
  }${r.renamed.length ? ` · id 바꿈 ${r.renamed.join(', ')}` : ''}`
}

interface RenderInput {
  store: SurveyStore
  active: SurveyModule | undefined
  hidden: Record<string, boolean>
  legacyToggles: LegacyToggles
  overlay: LegacyOverlay
  selected: string | null
  pending: string | null
  selectedEdge: string | null
  mode: Mode
}

/** 지도 스크립트(`window.__surveyRender`)에 넘길 그리기 상태. JSON 으로 비교해 같으면 다시 그리지 않는다. */
export function buildSurveyRenderState({ store, active, hidden, legacyToggles, overlay, selected, pending, selectedEdge, mode }: RenderInput) {
  const t = legacyToggles
  const legacyNodes = [
    ...(t.plainNodes ? overlay.plainNodes.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: n.id })) : []),
    ...(t.namedNodes
      ? overlay.namedNodes
          .filter((n) => t.namedFloors[floorKeyOf(n.floor)] !== false)
          .map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: `${n.id} (${floorKeyOf(n.floor)}, id 기반 추정)` }))
      : []),
    ...(t.unconnectedEntrances
      ? overlay.unconnectedEntrances.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: n.id }))
      : []),
  ]
  const legacyLines = [
    ...(t.nodeEdges ? overlay.nodeEdges.map((l) => [...l, 0]) : []),
    ...(t.anchorEdges ? overlay.anchorEdges.flatMap((e) => (e.line ? [[...e.line, 1]] : [])) : []),
  ]
  const shownSpecials = new Set(active?.nodes.filter((n) => n.kind).map((n) => n.sharedId ?? n.id))
  const modules = store.modules
    .filter((m) => !hidden[m.id] || m.id === store.activeModuleId)
    .map((m) => {
      const isActive = m.id === store.activeModuleId
      const byId = new Map(m.nodes.map((n) => [n.id, n]))
      return {
        id: m.id,
        color: m.color,
        dark: darken(m.color),
        dashed: m.status === 'draft',
        active: isActive,
        dim: !isActive,
        nodes: m.nodes.filter((n) => {
          if (isActive || !n.kind) return true
          const key = n.sharedId ?? n.id
          if (shownSpecials.has(key)) return false
          shownSpecials.add(key)
          return true
        }).map((n) => ({
          id: n.id,
          lat: n.lat,
          lng: n.lng,
          short: !isActive && n.kind ? `${shortId(n.id)} (${m.name})` : n.ref ? `${shortId(n.id)}(기존)` : shortId(n.id),
          memo: !!n.memo,
          kind: n.kind,
          label: isActive || (!!active && !!n.kind),
        })),
        edges: m.edges.flatMap((e) => {
          const A = byId.get(e.a)
          const B = byId.get(e.b)
          return A && B ? [{ id: e.id, a: e.a, b: e.b, p: [A.lat, A.lng, B.lat, B.lng], memo: !!e.memo, kind: e.kind }] : []
        }),
      }
    })
    // 편집 중인 모듈을 맨 나중에 그려 위로 올린다.
    .sort((x, y) => Number(x.active) - Number(y.active))
  return { legacy: { nodes: legacyNodes, lines: legacyLines }, modules, selected, pending, selectedEdge, mode }
}
