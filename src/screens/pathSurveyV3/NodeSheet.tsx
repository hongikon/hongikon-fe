import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { floorChipLabel, nextEntranceLabel, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { CheckIssue } from '../../utils/pathSurveyV3/check'
import type { ManualCandidate } from '../../utils/pathSurveyV3/convertV2'
import { nodesNear } from '../../utils/pathSurveyV3/levels'
import {
  findNode,
  setEntranceLabel,
  setNodeLevels,
  setNodeScope,
  setNodeTies,
  setNodeType,
  type StoreV3,
} from '../../utils/pathSurveyV3/store'
import { sameLevel, type LevelRef, type NodeScope, type NodeType, type SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import { Btn, Section, ui } from '../pathSurvey/ui'
import { Chip, MemoBox, Segmented } from './controls'
import { LevelEditor, PairEditor } from './LevelPicker'

const SCOPES: { key: NodeScope; label: string }[] = [
  { key: 'outdoor', label: '외부' },
  { key: 'indoor', label: '내부' },
]

const TYPES: { key: NodeType; label: string }[] = [
  { key: 'basic', label: '기본' },
  { key: 'stairs', label: '계단' },
  { key: 'elevator', label: '엘리베이터' },
  { key: 'entrance', label: '출입구' },
]

/** Entrance names are always chosen: from the server list, from labels already in the data, or generated. */
function EntranceLabelPicker({
  node,
  store,
  index,
  onChange,
}: {
  node: SurveyNodeV3
  store: StoreV3
  index: BuildingIndex
  onChange: (fn: (s: StoreV3) => StoreV3) => void
}) {
  const level = node.levels?.[0]
  const used = useMemo(() => store.nodes.flatMap((n) => (n.entranceLabel ? [n.entranceLabel] : [])), [store.nodes])
  if (!level) return <Text style={ui.warn}>{'출입구 이름을 고르려면 건물과 층을 먼저 고르세요. 비워 두면 점검에 오류로 나와요.'}</Text>
  const server = index.byCode.get(level.building)?.entrances ?? []
  const sorted = [...server].sort((x, y) => Number(y.floor === level.floor) - Number(x.floor === level.floor) || x.floor - y.floor)
  const fromData = [
    ...new Set(store.nodes.flatMap((n) => (n.entranceLabel && n.levels?.[0]?.building === level.building && !index.serverLabels.has(n.entranceLabel) ? [n.entranceLabel] : []))),
  ]
  const onServer = node.entranceLabel ? index.serverLabels.has(node.entranceLabel) : true

  const pickServer = (label: string, floor: number) =>
    onChange((s) => {
      // A label belongs to a floor, so the point follows it.
      const next = floor === level.floor ? s : setNodeLevels(s, node.id, [{ building: level.building, floor }])
      return setEntranceLabel(next, node.id, node.entranceLabel === label ? undefined : label)
    })

  return (
    <View style={styles.block}>
      <Text style={ui.sectionHelp}>{`출입구 이름${node.entranceLabel ? `: ${node.entranceLabel}` : ' (비어 있으면 점검 오류)'}`}</Text>
      {!onServer ? <Text style={ui.warn}>{'신규/서버에 없음. 나중에 서버 출입구 목록에 넣어야 해요.'}</Text> : null}
      <View style={styles.wrap}>
        {sorted.map((e) => (
          <Chip key={e.label} label={`${e.label} (${floorChipLabel(e.floor)})`} on={node.entranceLabel === e.label} onPress={() => pickServer(e.label, e.floor)} />
        ))}
        {fromData.map((label) => (
          <Chip
            key={label}
            label={`${label} (신규)`}
            on={node.entranceLabel === label}
            onPress={() => onChange((s) => setEntranceLabel(s, node.id, node.entranceLabel === label ? undefined : label))}
          />
        ))}
      </View>
      <Btn label="새 이름 자동으로 만들기" onPress={() => onChange((s) => setEntranceLabel(s, node.id, nextEntranceLabel(index, level, used)))} />
    </View>
  )
}

/** Quick change sheet for one point. Every change goes through the store at once, so check and undo follow. */
export default function NodeSheet({
  node,
  store,
  index,
  used,
  issues,
  candidates,
  contextLevels,
  onChange,
  onMemo,
  onSelect,
  onDelete,
  onClose,
}: {
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
}) {
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

  return (
    <Section title={`점 ${node.id}`} help={`${node.lat.toFixed(7)}, ${node.lng.toFixed(7)}${node.legacyId ? `, 옛 id ${node.legacyId}` : ''}`}>
      {issues.map((issue, i) => (
        <Text key={`${issue.code}:${i}`} style={issue.severity === 'error' ? ui.error : ui.warn}>
          {issue.message}
        </Text>
      ))}
      {near.length ? (
        <View style={styles.block}>
          <Text style={ui.sectionHelp}>{`같은 자리의 점 ${near.length}개`}</Text>
          <View style={styles.wrap}>
            {near.map((n) => (
              <Chip key={n.id} label={n.id} onPress={() => onSelect(n.id)} />
            ))}
          </View>
        </View>
      ) : null}
      {hasFloors ? (
        <View style={styles.block}>
          <Text style={ui.sectionHelp}>{'옛 메모에서 읽은 후보. 누르면 채워요.'}</Text>
          <View style={styles.wrap}>
            {candidates
              .filter((c) => c.floors?.length)
              .map((c) => {
                const name = index.byCode.get(c.building)?.name ?? c.building
                const floors = c.floors!
                const range = floors.length === 1 ? floorChipLabel(floors[0]) : `${floorChipLabel(floors[0])}~${floorChipLabel(floors[floors.length - 1])}`
                return <Chip key={`${c.building}:${c.label ?? range}`} label={`${name} ${range}층${c.label ? ` ${c.label}` : ''}`} onPress={() => applyCandidate(c)} />
              })}
          </View>
        </View>
      ) : null}
      <Segmented value={node.scope} options={SCOPES} onChange={(scope) => onChange((s) => setNodeScope(s, node.id, scope, levels.length ? [] : contextLevels))} />
      <Segmented value={node.type} options={TYPES} onChange={(type) => onChange((s) => setNodeType(s, node.id, type, contextLevels))} />
      {node.scope === 'indoor' ? (
        <LevelEditor
          key={node.type === 'entrance' ? 'single' : 'many'}
          index={index}
          levels={levels}
          used={used}
          single={node.type === 'entrance'}
          initialBuildings={levels.length ? [] : candidates.map((c) => c.building)}
          onChange={(next) => onChange((s) => setNodeLevels(s, node.id, next))}
        />
      ) : null}
      {node.type === 'entrance' && node.scope === 'indoor' ? <EntranceLabelPicker node={node} store={store} index={index} onChange={onChange} /> : null}
      {(node.type === 'stairs' || node.type === 'elevator') && buildingCount >= 2 ? (
        <View style={styles.block}>
          <Text style={ui.sectionHelp}>{'같은 높이 층 짝. 여러 건물에 걸치면 반드시 필요해요.'}</Text>
          <PairEditor
            index={index}
            left={levels}
            right={levels}
            pairs={node.ties ?? []}
            differentBuilding
            allowFill
            onChange={(pairs) => onChange((s) => setNodeTies(s, node.id, pairs))}
          />
        </View>
      ) : null}
      <MemoBox value={node.memo} onEdit={onMemo} />
      <View style={styles.actions}>
        <Btn label="닫기" onPress={onClose} />
        <Btn label="이 점과 연결 간선 지우기" kind="danger" onPress={onDelete} />
      </View>
      <Text style={ui.sectionHelp}>{'모든 변경은 되돌리기로 취소할 수 있어요.'}</Text>
    </Section>
  )
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
})
