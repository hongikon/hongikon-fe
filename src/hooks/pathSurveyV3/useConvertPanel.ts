import { useMemo, useState } from 'react'
import { pickTextFile } from '../../utils/pathSurvey/sync'
import { type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { isManualItemOpen, parseV2Text, readV2FromStorage, type ConvertReport, type ManualItem, type V2Source } from '../../utils/pathSurveyV3/convertV2'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { floorText } from '../../utils/pathSurveyV3/convertPanel'

/** ConvertPanel 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useConvertPanel({ store, index, report, multi, onConvert, onNotice }: Pick<{
  store: StoreV3
  index: BuildingIndex
  report: ConvertReport | null
  multi: readonly string[]
  selected: string | null
  onConvert: (source: V2Source) => void
  onFocus: (nodeId: string) => void
  onNotice: (message: string) => void
  onToggleMulti: (nodeId: string) => void
  /** fromAll marks a selection made with a select all button, which may mix buildings. */
  onSelectMany: (ids: string[], fromAll?: boolean) => void
  onKeepOutdoor: (ids: string[]) => void
  onResetKept: () => void
  onMakeIndoor: (ids: string[]) => void
}, 'store' | 'index' | 'report' | 'multi' | 'onConvert' | 'onNotice'>) {
  const [text, setText] = useState('')
  const hasLocal = useMemo(() => !!readV2FromStorage(), [])
  const nodeById = useMemo(() => new Map(store.nodes.map((n) => [n.id, n])), [store.nodes])
  const dismissed = report?.dismissed ?? []

  const fromText = (value: string) => {
    try {
      onConvert(parseV2Text(value))
      setText('')
    } catch (e) {
      onNotice(`변환하지 못했어요. ${(e as Error).message}`)
    }
  }

  const fromLocal = () => {
    const source = readV2FromStorage()
    if (source) onConvert(source)
    else onNotice('이 브라우저에 읽을 수 있는 v2 조사 내용이 없어요.')
  }

  const fromFile = async () => {
    const value = await pickTextFile()
    if (value) fromText(value)
  }

  const candidateText = (item: ManualItem) => item.candidates.map((c) => `${index.byCode.get(c.building)?.name ?? c.building}${floorText(c.floors)}`).join(', ')

  const manual = report?.manual ?? []
  const open = manual.filter((item) => isManualItemOpen(item, nodeById.get(item.nodeId), dismissed))
  const openBoundary = open.filter((item) => item.kind === 'boundary').map((item) => item.nodeId)
  const pickedBoundary = openBoundary.filter((id) => multi.includes(id))
  // Floors differ per building, so the usual bulk step is one building at a time.
  const boundaryByBuilding = new Map<string, string[]>()
  for (const item of open) {
    const code = item.kind === 'boundary' ? item.candidates[0]?.building : undefined
    if (code) boundaryByBuilding.set(code, [...(boundaryByBuilding.get(code) ?? []), item.nodeId])
  }
  return {
    text,
    setText,
    hasLocal,
    dismissed,
    fromText,
    fromLocal,
    fromFile,
    candidateText,
    manual,
    open,
    openBoundary,
    pickedBoundary,
    boundaryByBuilding,
  }
}
