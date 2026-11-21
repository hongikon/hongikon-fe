import { useMemo } from 'react'
import { type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { type StoreV3 } from '../../utils/pathSurveyV3/store'
import { type SurveyNodeV3 } from '../../utils/pathSurveyV3/types'

/** EntranceLabelPicker 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useEntranceLabelPicker({ node, store }: Pick<{
  node: SurveyNodeV3
  store: StoreV3
  index: BuildingIndex
  onChange: (fn: (s: StoreV3) => StoreV3) => void
}, 'node' | 'store'>) {
  const level = node.levels?.[0]
  const used = useMemo(() => store.nodes.flatMap((n) => (n.entranceLabel ? [n.entranceLabel] : [])), [store.nodes])
  return { level, used }
}
