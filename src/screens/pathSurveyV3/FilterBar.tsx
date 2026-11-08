import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import { ui } from '../pathSurvey/ui'
import { Chip } from './controls'
import { BuildingSearch, FloorPicker } from './LevelPicker'
import { buildingColor, NO_FILTER, type MapFilter } from './mapState'

/**
 * Search all buildings, selecting all floors or one floor per building. Matching indoor points and
 * all outdoor points stay strong; everything else is dimmed and cannot be pressed.
 */
export default function FilterBar({
  nodes,
  index,
  filter,
  onChange,
}: {
  nodes: readonly SurveyNodeV3[]
  index: BuildingIndex
  filter: MapFilter
  onChange: (next: MapFilter) => void
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
      <BuildingSearch index={index} selected={selected} onPick={toggleBuilding} />
      {unknownBuildings.length ? (
        <View style={styles.row}>
          {unknownBuildings.map((code) => (
            <Chip key={code} label={code} on={selected.includes(code)} color={buildingColor(index, code)} onPress={() => toggleBuilding(code)} />
          ))}
        </View>
      ) : null}
      {filter.selections.map(({ building, floor }) => (
        <View key={building} style={styles.group}>
          <View style={styles.row}>
            <Text style={ui.rowText}>{index.byCode.get(building)?.name ?? building}</Text>
            <Chip label="이 건물 빼기" onPress={() => toggleBuilding(building)} />
          </View>
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
})
