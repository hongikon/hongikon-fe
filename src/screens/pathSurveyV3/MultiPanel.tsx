import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { buildingsContaining, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { nodesInBuilding } from '../../utils/pathSurveyV3/levels'
import type { BulkChange } from '../../utils/pathSurveyV3/store'
import type { LevelRef, NodeType, SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import { Btn, Check, Row, Section, ui } from '../pathSurvey/ui'
import { Chip, Collapsible } from './controls'
import { BuildingSearch, LevelEditor } from './LevelPicker'

const TYPES: { key: NodeType; label: string }[] = [
  { key: 'basic', label: '기본' },
  { key: 'stairs', label: '계단' },
  { key: 'elevator', label: '엘리베이터' },
  { key: 'entrance', label: '출입구' },
]

/** Multi select: same building, floors and type for many points, as one undo step. */
export default function MultiPanel({
  nodes,
  index,
  used,
  selected,
  onSelect,
  onApply,
  onExit,
}: {
  nodes: readonly SurveyNodeV3[]
  index: BuildingIndex
  used: ReadonlyMap<string, number[]>
  selected: readonly string[]
  /** fromAll marks a selection made with a select all control, which may mix buildings. */
  onSelect: (ids: string[], fromAll?: boolean) => void
  onApply: (change: BulkChange) => void
  onExit: () => void
}) {
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

  return (
    <Section title={`여러 점 선택 (${selected.length}개)`} help="지도에서 점을 누르면 선택하거나 뺄 수 있어요. 선택한 점에 같은 값을 한 번에 넣어요. 되돌리기 한 번으로 취소돼요.">
      <Collapsible title="경계 안 점 모두 선택">
        <Check label="외부 점만" checked={outdoorOnly} onToggle={() => setOutdoorOnly((v) => !v)} />
        <BuildingSearch
          index={index}
          selected={insideOf}
          onPick={(code) => {
            setInsideOf(code)
            onSelect([...new Set([...selected, ...nodesInBuilding(nodes, index, code, outdoorOnly)])], true)
          }}
        />
      </Collapsible>
      <Text style={ui.sectionHelp}>{'건물과 층 (고르면 내부 점이 돼요)'}</Text>
      <LevelEditor key={nearby.join(',')} index={index} levels={levels} used={used} initialBuildings={nearby} onChange={setLevels} />
      <Text style={ui.sectionHelp}>{'종류 (고르지 않으면 그대로)'}</Text>
      <View style={styles.wrap}>
        {TYPES.map((t) => (
          <Chip key={t.key} label={t.label} on={type === t.key} onPress={() => setType(type === t.key ? null : t.key)} />
        ))}
      </View>
      <Row>
        <Btn
          label={`선택한 ${selected.length}개에 적용`}
          kind="primary"
          disabled={!canApply}
          onPress={() => onApply({ ...(levels.length ? { levels } : {}), ...(type ? { type } : {}) })}
        />
        <Btn label="외부로 바꾸기" disabled={selected.length === 0} onPress={() => onApply({ scope: 'outdoor' })} />
      </Row>
      <Row>
        <Btn label="선택 비우기" disabled={selected.length === 0} onPress={() => onSelect([])} />
        <Btn label="여러 점 선택 끝내기" onPress={onExit} />
      </Row>
    </Section>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
})
