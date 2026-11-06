import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { floorChipLabel, shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import { TOUCH, ui } from '../pathSurvey/ui'
import { buildingColor, type MapFilter } from './mapState'

function Chip({ label, on, color, onPress }: { label: string; on: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && { backgroundColor: color ?? '#05014A', borderColor: color ?? '#05014A' }]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  )
}

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
  chip: {
    minHeight: TOUCH,
    minWidth: TOUCH,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  chipTextOn: { color: '#FFFFFF', fontFamily: FONTS.semibold },
})
