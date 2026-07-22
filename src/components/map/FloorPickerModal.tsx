import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { buildFloorOptions } from '../../utils/floors'
import type { Building } from '../../types'
import { FONTS } from '../../constants/typography'

export type FloorTarget = 'from' | 'to'

interface FloorPickerModalProps {
  building: Building | null
  target: FloorTarget
  onConfirm: (floor: number) => void
  onCancel: () => void
}

const TARGET_TEXT = {
  from: { title: '출발 층 선택', accent: COLORS.routeFrom, icon: 'location' },
  to: { title: '도착 층 선택', accent: COLORS.routeTo, icon: 'flag' },
} as const

export default function FloorPickerModal({
  building,
  target,
  onConfirm,
  onCancel,
}: FloorPickerModalProps) {
  // 기본값은 출입구가 있는 1층.
  const [floor, setFloor] = useState(1)

  const options = building ? buildFloorOptions(building) : []
  if (!building || options.length === 0) return null

  const { title, accent, icon } = TARGET_TEXT[target]

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name={icon} size={15} color={accent} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onCancel} accessibilityLabel="닫기">
              <Ionicons name="close" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.buildingName}>{building.name}</Text>

          <Picker
            selectedValue={floor}
            onValueChange={(value) => setFloor(Number(value))}
            itemStyle={styles.pickerItem}
            style={styles.picker}
          >
            {options.map((option) => (
              <Picker.Item
                key={option.value}
                label={option.label}
                value={option.value}
              />
            ))}
          </Picker>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: accent }]}
            onPress={() => onConfirm(floor)}
          >
            <Text style={styles.confirmText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  buildingName: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  picker: { marginTop: 4 },
  pickerItem: { fontFamily: FONTS.regular, fontSize: 22, color: COLORS.textPrimary },
  confirmBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.white },
})
