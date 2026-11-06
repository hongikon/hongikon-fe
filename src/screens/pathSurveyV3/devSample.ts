import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { normalizeStoreV3, type StoreV3 } from '../../utils/pathSurveyV3/store'
import type { LevelRef, SurveyEdgeV3, SurveyNodeV3 } from '../../utils/pathSurveyV3/types'

/**
 * Sample graph for checking the drawing rules on localhost (only offered in development builds).
 * v2 data has no indoor stairs, so without this the triangle shape would have nothing to show.
 */
export function buildDevSample(index: BuildingIndex, now = Date.now()): StoreV3 | null {
  const [first, second] = index.list.filter((b) => b.entrances.length > 0)
  if (!first || !second) return null
  const base = { lat: first.rings[0]?.[0]?.[0] ?? 37.5513, lng: first.rings[0]?.[0]?.[1] ?? 126.9256 }
  const at = (dLat: number, dLng: number) => ({ lat: base.lat + dLat * 1e-4, lng: base.lng + dLng * 1e-4 })
  const a = (floor: number): LevelRef => ({ building: first.code, floor })
  const b = (floor: number): LevelRef => ({ building: second.code, floor })

  const nodes: SurveyNodeV3[] = [
    { id: 'n1', ...at(-3, -3), scope: 'outdoor', type: 'basic' },
    { id: 'n2', ...at(-3, 0), scope: 'outdoor', type: 'basic' },
    { id: 'n3', ...at(-1, 0), scope: 'indoor', type: 'entrance', levels: [a(1)], entranceLabel: first.entrances[0].label },
    { id: 'n4', ...at(0, 0), scope: 'indoor', type: 'basic', levels: [a(1), a(2), a(3)] },
    { id: 'n5', ...at(0, 2), scope: 'indoor', type: 'stairs', levels: [a(1), a(2), a(3)] },
    { id: 'n6', ...at(1, 0), scope: 'indoor', type: 'basic', levels: [a(3)] },
    { id: 'n7', ...at(1, 2), scope: 'indoor', type: 'elevator', levels: [a(1), a(2), a(3), b(1), b(2)], ties: [[a(2), b(1)], [a(3), b(2)]] },
    { id: 'n8', ...at(3, 3), scope: 'indoor', type: 'basic', levels: [b(1)] },
    { id: 'n9', ...at(3, 0), scope: 'indoor', type: 'entrance', levels: [b(2)], entranceLabel: second.entrances[0].label },
    { id: 'n10', ...at(-3, 3), scope: 'outdoor', type: 'basic' },
  ]
  const edges: SurveyEdgeV3[] = [
    { id: 'e1', a: 'n1', b: 'n2', kind: 'normal' },
    { id: 'e2', a: 'n2', b: 'n3', kind: 'normal' },
    { id: 'e3', a: 'n3', b: 'n4', kind: 'normal' },
    { id: 'e4', a: 'n4', b: 'n5', kind: 'normal' },
    { id: 'e5', a: 'n4', b: 'n6', kind: 'normal' },
    { id: 'e6', a: 'n5', b: 'n7', kind: 'normal' },
    { id: 'e7', a: 'n7', b: 'n8', kind: 'normal' },
    { id: 'e8', a: 'n6', b: 'n9', kind: 'normal' },
    { id: 'e9', a: 'n2', b: 'n10', kind: 'stairs' },
  ]
  return normalizeStoreV3({ nodes, edges, updatedAt: now }, now)
}
