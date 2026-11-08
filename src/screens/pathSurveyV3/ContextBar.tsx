import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { floorChipLabel, shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { updateWorkContext, type WorkContext } from '../../utils/pathSurveyV3/transfer'
import type { NodeType } from '../../utils/pathSurveyV3/types'
import { TOUCH, ui } from '../pathSurvey/ui'
import { Chip } from './controls'
import { BuildingSearch, FloorPicker } from './LevelPicker'

const TYPES: { key: NodeType; label: string }[] = [
  { key: 'basic', label: '기본' },
  { key: 'stairs', label: '계단' },
  { key: 'elevator', label: '엘리베이터' },
  { key: 'entrance', label: '출입구' },
]

/** Work context for new points. It stays set while points are placed. Picking floors here only changes local state. */
export default function ContextBar({
  index,
  context,
  used,
  closeSignal,
  onChange,
}: {
  index: BuildingIndex
  context: WorkContext
  used: ReadonlyMap<string, number[]>
  /** The picker folds away when this changes, so it does not cover the map while working. */
  closeSignal: string | null
  onChange: (next: WorkContext) => void
}) {
  const indoor = context.scope === 'indoor'
  const [open, setOpen] = useState(indoor && (!context.building || context.floors.length === 0))
  useEffect(() => {
    if (closeSignal) setOpen(false)
  }, [closeSignal])
  const set = (patch: Partial<WorkContext>) => onChange(updateWorkContext(context, patch))
  const single = context.type === 'entrance'
  const summary = context.building
    ? `${shortBuildingName(index.byCode.get(context.building), context.building)} / ${
        context.floors.length ? [...context.floors].sort((x, y) => x - y).map((f) => floorChipLabel(f)).join(', ') + '층' : '층을 고르세요'
      }`
    : '건물과 층을 고르세요'

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
        <Chip
          label="외부"
          on={!indoor}
          onPress={() => {
            set({ scope: 'outdoor' })
            setOpen(false)
          }}
        />
        <Chip
          label="내부"
          on={indoor}
          onPress={() => {
            set({ scope: 'indoor' })
            if (!context.building || context.floors.length === 0) setOpen(true)
          }}
        />
        <View style={styles.divider} />
        {TYPES.map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            on={context.type === t.key}
            onPress={() => {
              set({ type: t.key })
              if (t.key !== 'basic' && (!context.building || context.floors.length === 0)) setOpen(true)
            }}
          />
        ))}
      </ScrollView>
      {indoor ? (
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.summary} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <Text style={[styles.summaryText, (!context.building || context.floors.length === 0) && styles.summaryMissing]}>{`작업 층: ${summary}`}</Text>
          <Text style={ui.hint}>{open ? '접기' : '바꾸기'}</Text>
        </Pressable>
      ) : null}
      {indoor && open ? (
        <ScrollView style={styles.picker} contentContainerStyle={styles.pickerBody} keyboardShouldPersistTaps="handled">
          <BuildingSearch index={index} selected={context.building} onPick={(building) => set({ building, floors: [] })} />
          {context.building ? (
            <FloorPicker
              key={context.building}
              index={index}
              building={context.building}
              selected={context.floors}
              used={used.get(context.building) ?? []}
              single={single}
              onToggle={(floor) => {
                if (context.floors.includes(floor)) set({ floors: context.floors.filter((f) => f !== floor) })
                else set({ floors: single ? [floor] : [...context.floors, floor] })
              }}
              onSetMany={(floors, on) => set({ floors: on ? [...new Set([...context.floors, ...floors])] : context.floors.filter((f) => !floors.includes(f)) })}
            />
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  divider: { width: 1, height: 28, backgroundColor: COLORS.border, marginHorizontal: 2 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: TOUCH, gap: 8 },
  summaryText: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  summaryMissing: { color: '#B45309' },
  picker: { maxHeight: 260 },
  pickerBody: { gap: 8, paddingBottom: 4 },
})
