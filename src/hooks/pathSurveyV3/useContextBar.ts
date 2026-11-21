import { useEffect, useState } from 'react'
import { floorChipLabel, shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { updateWorkContext, type WorkContext } from '../../utils/pathSurveyV3/transfer'

/** ContextBar 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useContextBar({ index, context, closeSignal, onChange }: Pick<{
  index: BuildingIndex
  context: WorkContext
  used: ReadonlyMap<string, number[]>
  /** The picker folds away when this changes, so it does not cover the map while working. */
  closeSignal: string | null
  onChange: (next: WorkContext) => void
}, 'index' | 'context' | 'closeSignal' | 'onChange'>) {
  const indoor = context.scope === 'indoor'
  const [open, setOpen] = useState(indoor && (!context.building || context.floors.length === 0))
  useEffect(() => {
    if (closeSignal) setOpen(false)
  }, [closeSignal])
  const set = (patch: Partial<WorkContext>) => onChange(updateWorkContext(context, patch))
  const single = context.type === 'entrance'
  const summary = context.building
    ? `${shortBuildingName(index.byCode.get(context.building), context.building)} / ${
        context.floors.length ? [...context.floors].sort((x, y) => x - y).map((f) => floorChipLabel(f)).join(', ') + '층' : '층을 고르세요'
      }`
    : '건물과 층을 고르세요'
  return { indoor, open, setOpen, set, single, summary }
}
