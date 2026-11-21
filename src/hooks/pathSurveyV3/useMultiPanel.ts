import { useMemo, useState } from 'react'
import { buildingsContaining, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { BulkChange } from '../../utils/pathSurveyV3/store'
import type { LevelRef, NodeType, SurveyNodeV3 } from '../../utils/pathSurveyV3/types'

/** MultiPanel 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useMultiPanel({ nodes, index, selected }: Pick<{
  nodes: readonly SurveyNodeV3[]
  index: BuildingIndex
  used: ReadonlyMap<string, number[]>
  selected: readonly string[]
  /** fromAll marks a selection made with a select all control, which may mix buildings. */
  onSelect: (ids: string[], fromAll?: boolean) => void
  onApply: (change: BulkChange) => void
  onExit: () => void
}, 'nodes' | 'index' | 'selected'>) {
  const [levels, setLevels] = useState<LevelRef[]>([])
  const [type, setType] = useState<NodeType | null>(null)
  const [outdoorOnly, setOutdoorOnly] = useState(true)
  const [insideOf, setInsideOf] = useState<string | null>(null)

  // Buildings around the selection are offered first, floors stay a person's choice.
  const nearby = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const codes = selected.flatMap((id) => {
      const node = byId.get(id)
      return node ? buildingsContaining(index, node.lat, node.lng).map((b) => b.code) : []
    })
    return [...new Set(codes)].slice(0, 3)
  }, [nodes, index, selected])

  const canApply = selected.length > 0 && (levels.length > 0 || !!type)
  return {
    levels,
    setLevels,
    type,
    setType,
    outdoorOnly,
    setOutdoorOnly,
    insideOf,
    setInsideOf,
    nearby,
    canApply,
  }
}
