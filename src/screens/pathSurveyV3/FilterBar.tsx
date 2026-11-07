import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { floorChipLabel, shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import { ui } from '../pathSurvey/ui'
import { Chip } from './controls'
import { buildingColor, type MapFilter } from './mapState'

/**
 * Floor filter. Only offers buildings and floors that are in the data. With a filter on, points on that
 * building and floor and all outdoor points stay strong, everything else is dimmed and cannot be pressed.
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

  const buildings = [...levelsByBuilding.keys()].sort((x, y) => (index.byCode.get(x)?.order ?? 999) - (index.byCode.get(y)?.order ?? 999))
  const floors = filter.building ? [...(levelsByBuilding.get(filter.building) ?? [])].sort((x, y) => y - x) : []

  if (buildings.length === 0) return <Text style={ui.hint}>{'층 필터: 아직 내부 점이 없어요.'}</Text>

  return (
    <View style={styles.wrap}>
      <Text style={ui.sectionHelp}>{'층 필터'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
        <Chip label="전체" on={!filter.building} onPress={() => onChange({ building: null, floor: null })} />
        {buildings.map((code) => (
          <Chip
            key={code}
            label={shortBuildingName(index.byCode.get(code), code)}
            on={filter.building === code}
            color={buildingColor(index, code)}
            onPress={() => onChange({ building: code, floor: null })}
          />
        ))}
      </ScrollView>
      {filter.building ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
          <Chip label="모든 층" on={filter.floor === null} onPress={() => onChange({ building: filter.building, floor: null })} />
          {floors.map((floor) => (
            <Chip key={floor} label={floorChipLabel(floor)} on={filter.floor === floor} onPress={() => onChange({ building: filter.building, floor })} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
})
