import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { CheckIssue } from '../../utils/pathSurveyV3/check'
import { isManualItemOpen, type ConvertReport } from '../../utils/pathSurveyV3/convertV2'
import { findEdge, findNode, type BulkChange, type StoreV3 } from '../../utils/pathSurveyV3/store'
import type { LevelRef } from '../../utils/pathSurveyV3/types'
import { Btn } from '../pathSurvey/ui'
import EdgeSheet from './EdgeSheet'
import type { MapMode } from './mapState'
import MultiPanel from './MultiPanel'
import NodeSheet from './NodeSheet'

interface Props {
  mode: MapMode
  store: StoreV3
  index: BuildingIndex
  used: ReadonlyMap<string, number[]>
  multi: string[]
  onSelectMany: (ids: string[], fromAll?: boolean) => void
  onApplyBulk: (bulk: BulkChange) => void
  onExitSelect: () => void
  selected: string | null
  selectedEdge: string | null
  canEditNode: (id: string | null | undefined) => boolean
  canEditEdgeId: (id: string | null | undefined) => boolean
  /** Bumped by undo and full replaces: the sheets remount so memo boxes show the restored text. */
  undoTick: number
  allIssues: readonly CheckIssue[]
  report: ConvertReport | null
  contextLevels: LevelRef[]
  onChange: (fn: (s: StoreV3) => StoreV3) => void
  onNodeMemo: (id: string, text: string, first: boolean) => void
  onEdgeMemo: (id: string, text: string, first: boolean) => void
  onFocusNode: (id: string) => void
  onDeleteNode: (id: string) => void
  onDeleteEdge: (id: string) => void
  onKeepOutdoor: (ids: string[]) => void
  onClose: () => void
}

/** Selection sheets at the top of the panel: bulk values for many points, the point sheet (and keep outdoor), the edge sheet. Locked items get no sheet. */
export default function SelectionSheets(props: Props) {
  const { mode, store, index, used, multi, selected, selectedEdge, canEditNode, canEditEdgeId, undoTick, allIssues, report } = props
  const selectedNode = findNode(store, selected)
  const edge = findEdge(store, selectedEdge)
  const nodeIssues = selectedNode ? allIssues.filter((i) => i.nodeId === selectedNode.id && !i.edgeId) : []
  const edgeIssues = edge ? allIssues.filter((i) => i.edgeId === edge.id) : []
  const nodeManual = selectedNode ? (report?.manual ?? []).filter((m) => m.nodeId === selectedNode.id) : []
  const boundaryOpen = nodeManual.some((m) => m.kind === 'boundary' && isManualItemOpen(m, selectedNode, report?.dismissed))

  return (
    <>
      {mode === 'select' ? (
        <MultiPanel nodes={store.nodes} index={index} used={used} selected={multi} onSelect={props.onSelectMany} onApply={props.onApplyBulk} onExit={props.onExitSelect} />
      ) : null}
      {selectedNode && mode !== 'select' && canEditNode(selectedNode.id) ? (
        <NodeSheet
          key={`${selectedNode.id}:${undoTick}`}
          node={selectedNode}
          store={store}
          index={index}
          used={used}
          issues={nodeIssues}
          candidates={nodeManual.flatMap((m) => m.candidates)}
          contextLevels={props.contextLevels}
          onChange={props.onChange}
          onMemo={(text, first) => props.onNodeMemo(selectedNode.id, text, first)}
          onSelect={props.onFocusNode}
          onDelete={() => props.onDeleteNode(selectedNode.id)}
          onClose={props.onClose}
        />
      ) : null}
      {selectedNode && boundaryOpen && mode !== 'select' && selectedNode.scope === 'outdoor' ? <Btn label="이 점은 외부 유지" onPress={() => props.onKeepOutdoor([selectedNode.id])} /> : null}
      {edge && mode !== 'select' && canEditEdgeId(edge.id) ? (
        <EdgeSheet
          key={`${edge.id}:${undoTick}`}
          edge={edge}
          a={findNode(store, edge.a)}
          b={findNode(store, edge.b)}
          index={index}
          issues={edgeIssues}
          onChange={props.onChange}
          onMemo={(text, first) => props.onEdgeMemo(edge.id, text, first)}
          onDelete={() => props.onDeleteEdge(edge.id)}
          onClose={props.onClose}
        />
      ) : null}
    </>
  )
}
