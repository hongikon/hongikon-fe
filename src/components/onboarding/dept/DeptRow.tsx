import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import type { SubscribableItem } from '../../../constants/news'

interface DeptRowProps {
  item: SubscribableItem
  selected: boolean
  onToggle: (id: string) => void
}

/** [내 학과 고르기 한 줄] 이름과 동그란 체크. 누르면 그 게시판 구독을 토글한다. */
function DeptRow({ item, selected, onToggle }: DeptRowProps) {
  return (
    <Pressable
      onPress={() => onToggle(item.id)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={item.name}
    >
      <Text style={[styles.rowName, selected && styles.rowNameOn]}>{item.name}</Text>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected && <Ionicons name="checkmark" size={15} color={COLORS.white} />}
      </View>
    </Pressable>
  )
}

export default memo(DeptRow)

const styles = StyleSheet.create({
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: RADIUS.md,
  },
  rowPressed: { backgroundColor: COLORS.fill },
  rowName: { flex: 1, marginRight: 12, fontSize: 16, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  rowNameOn: { fontFamily: FONTS.semibold, color: COLORS.primary },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.toggleOff,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
})
