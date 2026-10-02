import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native'
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
 * 고르는 칩. 지도 필터 칩(chipStyles)과 같은 높이·모서리·글자를 쓰고, 고르면 브랜드색으로 채운다.
 * 검색 모드·제휴 소속·제보 기간처럼 지도 밖 화면의 칩도 이걸 써서 한 모양으로 보이게 한다.
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
        selected && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
        pressed && { opacity: 0.75 },
        style,
      ]}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={role === 'button' ? { selected } : { checked: selected }}
      aria-checked={role === 'button' ? undefined : selected}
      aria-selected={role === 'button' ? selected : undefined}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? COLORS.white : COLORS.chipText} />}
      <Text style={[chipStyles.label, selected && chipStyles.labelActive]}>{label}</Text>
    </Pressable>
  )
}
