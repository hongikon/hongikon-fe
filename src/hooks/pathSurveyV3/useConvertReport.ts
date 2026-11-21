import { useState, type MutableRefObject } from 'react'
import { editableNodeIds, type MapFilter } from '../../screens/pathSurveyV3/mapState'
import { LOCKED_TEXT } from '../../screens/pathSurveyV3/screenModel'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { convertV2, loadConvertReport, saveConvertReport, type ConvertReport, type V2Source } from '../../utils/pathSurveyV3/convertV2'
import { setNodeScope, type StoreV3 } from '../../utils/pathSurveyV3/store'
import type { SurveySelection } from './useSurveySelection'

interface ConvertOptions {
  index: BuildingIndex
  storeRef: MutableRefObject<StoreV3>
  change: (fn: (s: StoreV3) => StoreV3) => void
  replaceAll: (next: StoreV3, snapshotName: string, summary: string, warning?: string) => boolean
  selection: SurveySelection
  filter: MapFilter
  onlyFilter: boolean
  selectMany: (ids: string[], fromAll?: boolean) => void
  focusOn: (lat: number, lng: number) => void
  focusNode: (id: string) => void
  scrollPanelTop: () => void
  setNotice: (text: string) => void
}

/** The v2 conversion tab: importing v2 data, the report (manual check list), keep outdoor and make indoor. The report is kept on the device. */
export function useConvertReport(options: ConvertOptions) {
  const { index, storeRef, change, replaceAll, selection, filter, onlyFilter, selectMany, focusOn, focusNode, scrollPanelTop, setNotice } = options
  const { multi, multiFromAll, setMulti, setMode, setSelected, setSelectedEdge, setPending } = selection
  const [report, setReport] = useState<ConvertReport | null>(() => loadConvertReport())

  const runConvert = (source: V2Source) => {
    if (index.list.length === 0) return setNotice('건물 목록이 아직 없어요. 온라인에서 한 번 연 뒤 다시 해 주세요.')
    const { store: next, report: result } = convertV2(source.modules, index)
    if (!replaceAll(next, 'v2 변환 직전', `가져올 내용: 지점 ${result.mergedNodes}, 간선 ${result.mergedEdges}`)) return
    setReport(result)
    saveConvertReport(result)
    const first = next.nodes[0]
    if (first) focusOn(first.lat, first.lng)
    setNotice(`v2 에서 가져왔어요. 지점 ${result.mergedNodes}, 간선 ${result.mergedEdges}. 수동 확인 ${result.manual.length}건`)
  }

  const updateReport = (fn: (r: ConvertReport) => ConvertReport) => {
    setReport((old) => {
      if (!old) return old
      const next = fn(old)
      saveConvertReport(next)
      return next
    })
  }

  const keepOutdoor = (ids: string[]) => {
    updateReport((r) => ({ ...r, dismissed: [...new Set([...(r.dismissed ?? []), ...ids])] }))
    selectMany(multi.filter((id) => !ids.includes(id)), multiFromAll)
    setNotice(`외부 유지 ${ids.length}건 처리했어요`)
  }

  /** One point opens its sheet with the boundary building ready. Many points go to the bulk panel. */
  const makeIndoor = (all: string[]) => {
    const ids = editableNodeIds(storeRef.current, all, filter, onlyFilter)
    if (ids.length === 0) return setNotice(LOCKED_TEXT)
    if (ids.length === 1) {
      change((s) => setNodeScope(s, ids[0], 'indoor'))
      focusNode(ids[0])
      setNotice(`${ids[0]} 를 내부로 바꿨어요. 층을 골라 주세요.`)
      return
    }
    setMulti(ids)
    setMode('select')
    setSelected(null)
    setSelectedEdge(null)
    setPending(null)
    scrollPanelTop()
    setNotice(`${ids.length}개를 골랐어요. 위에서 건물과 층을 골라 적용해 주세요.`)
  }

  return { report, updateReport, runConvert, keepOutdoor, makeIndoor }
}
