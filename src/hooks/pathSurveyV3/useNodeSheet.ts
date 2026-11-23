import { useMemo } from 'react'
import { type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { CheckIssue } from '../../utils/pathSurveyV3/check'
import type { ManualCandidate } from '../../utils/pathSurveyV3/convertV2'
import { nodesNear } from '../../utils/pathSurveyV3/levels'
import { findNode, setEntranceLabel, setNodeLevels, setNodeScope, type StoreV3 } from '../../utils/pathSurveyV3/store'
import { sameLevel, type LevelRef, type SurveyNodeV3 } from '../../utils/pathSurveyV3/types'

/** State, effects and handlers of NodeSheet. The screen file only renders. */
export function useNodeSheet({ node, store, candidates, onChange }: Pick<{
  node: SurveyNodeV3
  store: StoreV3
  index: BuildingIndex
  used: ReadonlyMap<string, number[]>
  issues: readonly CheckIssue[]
  candidates: readonly ManualCandidate[]
  contextLevels: LevelRef[]
  onChange: (fn: (s: StoreV3) => StoreV3) => void
  onMemo: (text: string, first: boolean) => void
  onSelect: (id: string) => void
  onDelete: () => void
  onClose: () => void
}, 'node' | 'store' | 'candidates' | 'onChange'>) {
  const levels = node.levels ?? []
  const buildingCount = new Set(levels.map((l) => l.building)).size
  const near = useMemo(() => nodesNear(store.nodes, node), [store.nodes, node])
  const hasFloors = candidates.some((c) => c.floors?.length)

  const applyCandidate = (c: ManualCandidate) =>
    onChange((s) => {
      let next = setNodeScope(s, node.id, 'indoor')
      const picked = (c.floors ?? []).map((floor) => ({ building: c.building, floor }))
      if (picked.length) {
        const old = findNode(next, node.id)?.levels ?? []
        const merged = node.type === 'entrance' ? picked.slice(0, 1) : [...old.filter((l) => !picked.some((p) => sameLevel(p, l))), ...picked]
        next = setNodeLevels(next, node.id, merged)
      }
      if (c.label) next = setEntranceLabel(next, node.id, c.label)
      return next
    })
  return { levels, buildingCount, near, hasFloors, applyCandidate }
}
