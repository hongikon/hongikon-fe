import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { ICON_BUTTON_SIZE, ICON_SIZE } from '../../constants/spacing'

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  accessibilityLabel: string
  color?: string
  size?: number
  style?: StyleProp<ViewStyle>
  accessibilityRole?: 'button' | 'link'
}

/**
 * 머리줄의 뒤로 가기·닫기·검색·북마크 같은 아이콘만 있는 버튼.
 * 바탕 없이 40×40 터치 영역에 22 아이콘을 그린다(화면마다 회색 상자/맨 아이콘이 섞이지 않게).
 */
export default function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = COLORS.textPrimary,
  size = ICON_SIZE.lg,
  style,
  accessibilityRole = 'button',
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: ICON_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: COLORS.fill },
})
