import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { chipStyles } from '../map/chipStyles'

interface ChipProps {
  label: string
  selected: boolean
  onPress: () => void
  icon?: keyof typeof Ionicons.glyphMap
  /** 'radio' 는 하나만 고르는 줄(검색 모드 등), 'checkbox' 는 여러 개 고르는 줄 */
  role?: 'radio' | 'checkbox' | 'button'
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

/**
 * 고른 것의 바탕: 옅은 회색 알약(하단 탭 바·소식 세그먼트 GlassLens 와 같은 색, 10-08). 글자·아이콘은 남색으로 바꿔 알린다.
 * 남색으로 꽉 채우거나 테두리만 바꾸는 선택 표시는 쓰지 않는다(지도 필터 칩·층 칩은 일부러 색을 채우므로 예외).
 */
export const SELECTED_PILL_BG = 'rgba(118,118,128,0.14)'

/**
 * 고르는 칩. 지도 필터 칩(chipStyles)과 같은 높이·모서리·글자를 쓰고, 고르면 회색 알약 + 남색 글자가 된다.
 * 검색 모드·정보 제보 종류·제보 기간처럼 지도 밖 화면의 칩도 이걸 써서 한 모양으로 보이게 한다.
 */
export default function Chip({
  label,
  selected,
  onPress,
  icon,
  role = 'button',
  style,
  accessibilityLabel,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        chipStyles.chip,
        selected && styles.selected,
        pressed && { opacity: 0.75 },
        style,
      ]}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={role === 'button' ? { selected } : { checked: selected }}
      aria-checked={role === 'button' ? undefined : selected}
      aria-selected={role === 'button' ? selected : undefined}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? COLORS.primary : COLORS.chipText} />}
      <Text style={[chipStyles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  selected: { backgroundColor: SELECTED_PILL_BG, borderColor: 'transparent' },
  selectedLabel: { color: COLORS.primary },
})
