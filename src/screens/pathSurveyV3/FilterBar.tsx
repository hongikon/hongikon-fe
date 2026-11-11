import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import { ui } from '../pathSurvey/ui'
import { Chip } from './controls'
import { BuildingSearch, FloorPicker } from './LevelPicker'
import type { ChangeCounts } from '../../utils/pathSurveyV3/changes'
import { buildingColor, CHANGE_ADDED_COLOR, CHANGE_ADDED_RING, CHANGE_CHANGED_COLOR, NO_FILTER, selectionsInListOrder, type MapFilter } from './mapState'

function CheckRow({ testID, label, on, onToggle }: { testID: string; label: string; on: boolean; onToggle: () => void }) {
  return (
    <Pressable testID={testID} onPress={onToggle} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label}>
      <View style={[styles.box, on && styles.boxOn]}>{on ? <View style={styles.boxMark} /> : null}</View>
      <Text style={ui.rowText}>{label}</Text>
    </Pressable>
  )
}

/**
 * Search all buildings, selecting all floors or one floor per building. Matching indoor points and
 * all outdoor points stay strong; everything else is dimmed. With "only the filter" on (the default) the
 * dimmed ones cannot be pressed or edited; with it off they can.
 */
export default function FilterBar({
  nodes,
  index,
  filter,
  onChange,
  onlyFilter,
  onToggleOnlyFilter,
  showChanges,
  onToggleShowChanges,
  changeCounts,
}: {
  nodes: readonly SurveyNodeV3[]
  index: BuildingIndex
  filter: MapFilter
  onChange: (next: MapFilter) => void
  onlyFilter: boolean
  onToggleOnlyFilter: () => void
  showChanges: boolean
  onToggleShowChanges: () => void
  /** Counts since the last save while "show changes" is on. null: no save to compare with. undefined: off. */
  changeCounts: ChangeCounts | null | undefined
}) {
  const levelsByBuilding = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const node of nodes) {
      if (node.scope !== 'indoor') continue
      for (const level of node.levels ?? []) {
        if (!map.has(level.building)) map.set(level.building, new Set())
        map.get(level.building)!.add(level.floor)
      }
    }
    return map
  }, [nodes])

  const selected = filter.selections.map((selection) => selection.building)
  // Keep codes from older survey data accessible even if absent from the current server list.
  const unknownBuildings = [...levelsByBuilding.keys()].filter((code) => !index.byCode.has(code))

  const toggleBuilding = (building: string) => {
    onChange({
      selections: selected.includes(building)
        ? filter.selections.filter((selection) => selection.building !== building)
        : [...filter.selections, { building, floor: null }],
    })
  }

  const setFloor = (building: string, floor: number | null) => {
    onChange({ selections: filter.selections.map((selection) => (selection.building === building ? { building, floor } : selection)) })
  }

  return (
    <View style={styles.wrap}>
      <Text style={ui.sectionHelp}>{'층 필터'}</Text>
      <Text style={ui.hint}>{'건물은 여러 개 선택할 수 있고, 건물마다 모든 층 또는 한 층을 볼 수 있어요. 선택한 건물을 다시 누르면 해제돼요.'}</Text>
      <View style={styles.row}>
        <Chip label="전체" on={selected.length === 0} onPress={() => onChange(NO_FILTER)} />
      </View>
      <CheckRow testID="only-filter" label="선택한 필터만 수정" on={onlyFilter} onToggle={onToggleOnlyFilter} />
      <Text style={ui.hint}>
        {onlyFilter
          ? '켜짐: 필터 밖 점과 간선은 흐리게 보이고 누르거나 고칠 수 없어요. 외부 점은 늘 고칠 수 있어요.'
          : '꺼짐: 필터 밖 점과 간선도 흐리게 보이지만 누르고 고칠 수 있어요.'}
      </Text>
      <View style={styles.row}>
        <CheckRow testID="show-changes" label="바뀐 것 표시" on={showChanges} onToggle={onToggleShowChanges} />
        {changeCounts ? (
          <Text style={ui.rowText}>{`추가 ${changeCounts.added}, 수정 ${changeCounts.changed}, 삭제 ${changeCounts.removed}`}</Text>
        ) : null}
      </View>
      {changeCounts === null ? (
        <Text style={ui.hint}>{'비교할 저장이 아직 없어요. 저장 버튼을 누르면 그 뒤로 바뀐 것을 보여 줘요.'}</Text>
      ) : changeCounts ? (
        <View style={styles.row}>
          <View style={[styles.legendDot, styles.legendAdded]} />
          <Text style={ui.hint}>{'추가(노란 바탕, 파선 테두리)'}</Text>
          <View style={[styles.legendDot, styles.legendChanged]} />
          <Text style={ui.hint}>{'수정(자홍색 점선 테두리)'}</Text>
          <Text style={ui.hint}>{'마지막 저장과 비교, 점과 간선 합계. 삭제는 개수만 보여요.'}</Text>
        </View>
      ) : null}
      <BuildingSearch index={index} selected={selected} onPick={toggleBuilding} />
      {unknownBuildings.length ? (
        <View style={styles.row}>
          {unknownBuildings.map((code) => (
            <Chip key={code} label={code} on={selected.includes(code)} color={buildingColor(index, code)} onPress={() => toggleBuilding(code)} />
          ))}
        </View>
      ) : null}
      {selectionsInListOrder(filter, index).map(({ building, floor }) => (
        <View key={building} style={styles.group}>
          <View style={styles.row}>
            <Text style={ui.rowText}>{index.byCode.get(building)?.name ?? building}</Text>
            <Chip label="이 건물 빼기" onPress={() => toggleBuilding(building)} />
          </View>
          {levelsByBuilding.has(building) ? null : <Text style={ui.hint}>{'이 건물에는 아직 내부 점이 없어요. 외부 점만 진하게 보여요.'}</Text>}
          <View style={styles.row}>
            <Chip label="모든 층" on={floor === null} color={buildingColor(index, building)} onPress={() => setFloor(building, null)} />
          </View>
          <FloorPicker
            index={index}
            building={building}
            selected={floor === null ? [] : [floor]}
            used={[...(levelsByBuilding.get(building) ?? [])]}
            single
            onToggle={(next) => setFloor(building, floor === next ? null : next)}
          />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  group: { gap: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8FAFC' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, alignSelf: 'flex-start' },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  boxOn: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  boxMark: { width: 8, height: 8, borderRadius: 2, backgroundColor: '#FFFFFF' },
  legendDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  legendAdded: { borderStyle: 'dashed', borderColor: CHANGE_ADDED_RING, backgroundColor: CHANGE_ADDED_COLOR },
  legendChanged: { borderStyle: 'dotted', borderColor: CHANGE_CHANGED_COLOR },
})
