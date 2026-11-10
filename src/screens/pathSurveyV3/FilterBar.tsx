import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import { ui } from '../pathSurvey/ui'
import { Chip } from './controls'
import { BuildingSearch, FloorPicker } from './LevelPicker'
import { buildingColor, NO_FILTER, selectionsInListOrder, type MapFilter } from './mapState'

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
}: {
  nodes: readonly SurveyNodeV3[]
  index: BuildingIndex
  filter: MapFilter
  onChange: (next: MapFilter) => void
  onlyFilter: boolean
  onToggleOnlyFilter: () => void
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
      <Pressable
        testID="only-filter"
        onPress={onToggleOnlyFilter}
        style={styles.check}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: onlyFilter }}
        accessibilityLabel="선택한 필터만 수정"
      >
        <View style={[styles.box, onlyFilter && styles.boxOn]}>{onlyFilter ? <View style={styles.boxMark} /> : null}</View>
        <Text style={ui.rowText}>{'선택한 필터만 수정'}</Text>
      </Pressable>
      <Text style={ui.hint}>
        {onlyFilter
          ? '켜짐: 필터 밖 점과 간선은 흐리게 보이고 누르거나 고칠 수 없어요. 외부 점은 늘 고칠 수 있어요.'
          : '꺼짐: 필터 밖 점과 간선도 흐리게 보이지만 누르고 고칠 수 있어요.'}
      </Text>
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
})
