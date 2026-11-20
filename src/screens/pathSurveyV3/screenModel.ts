import { isManualItemOpen, type ConvertReport } from '../../utils/pathSurveyV3/convertV2'
import type { Snapshot } from '../../utils/pathSurveyV3/snapshots'
import type { SplitRefusal, StoreV3 } from '../../utils/pathSurveyV3/store'
import type { BackupVia } from '../../utils/pathSurveyV3/transfer'
import type { SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import { floorKeyOf, type LegacyOverlay } from '../pathSurvey/legacyOverlay'
import type { LegacyToggles } from '../pathSurvey/LegacyPanel'
import type { LabelMode, MapMode } from './mapState'

/**
 * Screen constants and stateless helpers of the v3 survey screen (DevPathSurveyV3Screen).
 * No React here, so the node tests can import it (scripts/test/pathsurvey-v3-screen.test.ts).
 */

export type Tab = 'edit' | 'check' | 'convert' | 'backup' | 'server' | 'snapshots' | 'legacy'

export const MODES: { key: MapMode; label: string; help: string }[] = [
  { key: 'add', label: '점 찍기', help: '지도를 누르면 위의 설정대로 점이 생겨요. 이어 찍기를 켜면 직전 점과 간선으로 이어요.' },
  { key: 'link', label: '잇기', help: '점 두 개를 차례로 누르면 간선이 생겨요. 이어서 누르면 계속 이어지고, 같은 점을 다시 누르면 끊겨요. 이미 있는 간선을 다시 이으면 지워져요.' },
  { key: 'move', label: '옮기기', help: '점을 끌어서 옮겨요. 다른 간선 위에 놓으면 그 간선을 둘로 나눠요.' },
  { key: 'select', label: '여러 점', help: '점을 눌러 여러 개 고른 뒤 같은 건물, 층, 종류를 한 번에 넣어요.' },
]

export const LABEL_MODES: { key: LabelMode; label: string }[] = [
  { key: 'none', label: '없음' },
  { key: 'number', label: '번호' },
  { key: 'full', label: '번호+동' },
  { key: 'selected', label: '선택한 점만' },
]

export const BACKUP_VIA: Record<BackupVia, string> = { file: '파일', copy: '코드 복사', gist: 'Gist' }

export const SPLIT_REFUSED: Record<SplitRefusal, string> = {
  missing: '간선이나 양 끝 점을 찾지 못해 나누지 않았어요.',
  pairs: '층 짝이 있는 간선이라 나누지 않았어요. 점을 따로 찍어 이어 주세요.',
  mixed: '양 끝 점의 위치(외부/내부, 건물, 층)가 달라서 나누지 않았어요. 점을 따로 찍어 이어 주세요.',
  end: '끝점과 같은 자리라 나누지 않았어요.',
}

export const LOCKED_TEXT = "필터 밖이라 고칠 수 없어요. 필터를 바꾸거나 '선택한 필터만 수정'을 꺼 주세요."

export const CORRUPT_TEXT = '저장된 조사 내용(v3)을 읽지 못했어요. 덮어쓰지 않도록 저장을 멈췄어요. 개발자 도구로 값을 확인해 주세요.'

export const OTHER_TAB_TEXT = '다른 탭에서 조사 내용을 저장했어요. 서로 덮어쓰지 않도록 이 탭은 저장을 멈췄어요. 새로고침해 주세요.'

/** Passes only messages sent by this screen's map script. */
export function parseSurveyMessage(event: unknown): any | null {
  const e = event as any
  const raw = e?.nativeEvent?.data ?? e?.data ?? e
  try {
    const msg = typeof raw === 'string' ? JSON.parse(raw) : raw
    return msg && msg.src === 'surveyV3' ? msg : null
  } catch {
    return null
  }
}

/** The grey overlay of the old data (pathNodes.ts) in the shape the map script draws. */
export function legacyRenderPayload(overlay: LegacyOverlay, t: LegacyToggles) {
  return {
    nodes: [
      ...(t.plainNodes ? overlay.plainNodes.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: n.id })) : []),
      ...(t.namedNodes
        ? overlay.namedNodes
            .filter((n) => t.namedFloors[floorKeyOf(n.floor)] !== false)
            .map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: `${n.id} (${floorKeyOf(n.floor)})` }))
        : []),
      ...(t.unconnectedEntrances ? overlay.unconnectedEntrances.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: n.id })) : []),
    ],
    lines: [
      ...(t.nodeEdges ? overlay.nodeEdges.map((l) => [...l, 0]) : []),
      ...(t.anchorEdges ? overlay.anchorEdges.flatMap((e) => (e.line ? [[...e.line, 1]] : [])) : []),
    ],
  }
}

/** Base of "show changes": the newest save button point (rolling slot). */
export function latestRollingSnapshot(snapshots: readonly Snapshot[]): Snapshot | null {
  return snapshots.filter((s) => s.kind === 'rolling').reduce<Snapshot | null>((best, s) => (!best || s.createdAt > best.createdAt ? s : best), null)
}

/** Manual check items of the v2 conversion still open on the current data. */
export function openManualCount(store: StoreV3, report: ConvertReport | null): number {
  const byId = new Map(store.nodes.map((n) => [n.id, n]))
  return (report?.manual ?? []).filter((item) => isManualItemOpen(item, byId.get(item.nodeId), report?.dismissed)).length
}

/** Notice after a map tap placed `made` (chained from `from` when chaining is on). */
export function placedNotice(made: SurveyNodeV3, from: SurveyNodeV3 | null | undefined, strong: boolean, onlyFilter: boolean): string {
  const crossing = from && (from.scope === 'indoor') !== (made.scope === 'indoor') && (from.scope === 'indoor' ? from : made).type !== 'entrance'
  const notes = [`${made.id} 추가${from ? `, ${from.id} 와 이었어요` : ''}`]
  if (crossing) notes.push('외부 점과 내부 점은 출입구로만 이을 수 있어 이 간선은 점검에서 오류로 나와요')
  if (made.type === 'entrance') notes.push('아래에서 건물, 층, 이름을 고르세요. 비워 두면 점검 오류로 나와요')
  else if (made.scope === 'indoor' && !made.levels?.length) notes.push('건물과 층이 없어 점검 오류로 나와요')
  if (!strong) notes.push(`지금 층 필터 밖의 점이라 흐리게 보여요${onlyFilter ? '. 다른 점을 고르면 이 점은 잠겨요' : ''}`)
  return notes.join('. ')
}
