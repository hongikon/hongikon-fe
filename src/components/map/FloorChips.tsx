import { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { buildFloorOptions } from '../../utils/floors'
import type { Building } from '../../types'

interface FloorChipsProps {
  label: string
  building: Building
  floor: number | null
  accent: string
  onChange: (floor: number | null) => void
}

/**
 * 길찾기 결과 카드 안에서 출발/도착 층을 고르는 칩 줄.
 *
 * 건물을 고를 때마다 다이얼 모달을 띄우면 흐름이 끊기고 길찾기 모달 위에 모달이
 * 겹친다. 그래서 층은 건물을 고른 뒤 결과 카드에서 언제든 바꾸게 하고, 바꾸는 즉시
 * 경로·소요 시간이 다시 계산되게 한다. '선택 안 함'이면 건물 대표 좌표로 잇는다.
 */
export default function FloorChips({ label, building, floor, accent, onChange }: FloorChipsProps) {
  const options = useMemo(() => buildFloorOptions(building), [building])
  if (options.length === 0) return null

  const chips: { key: string; text: string; value: number | null }[] = [
    { key: 'none', text: '선택 안 함', value: null },
    ...options.map((option) => ({ key: String(option.value), text: option.label, value: option.value })),
  ]

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {chips.map((chip) => {
          const selected = chip.value === floor
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, selected && { backgroundColor: accent, borderColor: accent }]}
              onPress={() => onChange(chip.value)}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${chip.text}`}
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{chip.text}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginTop: 10, gap: 6 },
  label: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  row: { gap: 6, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    backgroundColor: COLORS.white,
  },
  chipText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.chipText },
  chipTextSelected: { color: COLORS.white },
})
