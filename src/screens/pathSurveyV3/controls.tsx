import { useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { floorChipLabel, shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { LevelRef } from '../../utils/pathSurveyV3/types'
import { TOUCH, ui } from '../pathSurvey/ui'
import { chainToggleLabel } from './editHistory'

/** Small shared controls of the v3 screen. All of them have phone sized touch targets. */

export function Chip({ label, on, color, onPress, disabled }: { label: string; on?: boolean; color?: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.chip, on && { backgroundColor: color ?? '#05014A', borderColor: color ?? '#05014A' }, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  )
}

/** Same height as the mode buttons. The row keeps its height in the other modes, so the rows below it do not jump. */
export function ChainToggle({ visible, on, onToggle }: { visible: boolean; on: boolean; onToggle: () => void }) {
  return (
    <View style={styles.chainRow}>
      {visible ? (
        <Pressable
          testID="chain-toggle"
          onPress={onToggle}
          style={[styles.chainButton, on && styles.chainButtonOn]}
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
        >
          <Text style={[styles.chainText, on && styles.chipTextOn]}>{chainToggleLabel(on)}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (key: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          style={[styles.segment, value === o.key && styles.segmentOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.key }}
        >
          <Text style={[styles.chipText, value === o.key && styles.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function Collapsible({ title, initialOpen = false, children }: { title: string; initialOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <View style={styles.collapsible}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.collapsibleHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={ui.rowText}>{title}</Text>
        <Text style={ui.hint}>{open ? '접기' : '펴기'}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  )
}

/**
 * Optional memo. Typing stays local to the input, so the map is not redrawn. The first change after focusing
 * is reported as first, which makes the whole edit one undo step.
 */
export function MemoBox({ value, onEdit }: { value: string | undefined; onEdit: (text: string, first: boolean) => void }) {
  const first = useRef(true)
  return (
    <Collapsible title={value ? '메모 (있음)' : '메모 (선택)'} initialOpen={!!value}>
      <TextInput
        defaultValue={value ?? ''}
        onFocus={() => {
          first.current = true
        }}
        onChangeText={(text) => {
          onEdit(text, first.current)
          first.current = false
        }}
        placeholder="메모 (선택 입력)"
        multiline
        style={ui.memoInput}
      />
    </Collapsible>
  )
}

export const levelName = (index: BuildingIndex, level: LevelRef) => `${shortBuildingName(index.byCode.get(level.building), level.building)} ${floorChipLabel(level.floor)}층`

const styles = StyleSheet.create({
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
  disabled: { opacity: 0.4 },
  chainRow: { minHeight: TOUCH },
  chainButton: {
    minHeight: TOUCH,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainButtonOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chainText: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  segmented: { flexDirection: 'row', gap: 6 },
  segment: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: COLORS.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOn: { backgroundColor: '#05014A' },
  collapsible: { gap: 6 },
  collapsibleHead: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH, gap: 8 },
})
