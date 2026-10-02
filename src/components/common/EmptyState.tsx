import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { TYPE } from '../../constants/typography'
import { ICON_SIZE, SPACING } from '../../constants/spacing'

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap
  message: string
  description?: string
  /** 아래 버튼(보통 `<Button size="md" fullWidth={false} />`) */
  action?: ReactNode
  style?: StyleProp<ViewStyle>
}

/** 목록이 비었을 때의 안내. 아이콘 크기·색, 글자 색, 버튼 자리를 화면마다 같게 맞춘다. */
export default function EmptyState({ icon, message, description, action, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name={icon} size={ICON_SIZE.empty} color={COLORS.iconMuted} />
      <Text style={styles.message}>{message}</Text>
      {description !== undefined && <Text style={styles.description}>{description}</Text>}
      {action !== undefined && <View style={styles.action}>{action}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xxxl,
  },
  message: { ...TYPE.body, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs },
  description: { ...TYPE.caption, color: COLORS.textTertiary, textAlign: 'center' },
  action: { marginTop: SPACING.sm },
})
