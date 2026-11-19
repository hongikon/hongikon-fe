import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { RADIUS } from '../../constants/spacing'
import { FONTS } from '../../constants/typography'
import { Button } from './Button'
import { ADMIN_COLORS } from './theme'

/** 요청 실패 안내. 문구는 client 가 만든 한국어 문구만 넘긴다. */
export function InlineError({ message, onRetry, style }: { message: string; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.error, style]} accessibilityRole="alert">
      <Ionicons name="warning-outline" size={16} color={COLORS.danger} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button label="다시 시도" onPress={onRetry} small /> : null}
    </View>
  )
}

export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={COLORS.primary} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="checkmark-done-outline" size={28} color={COLORS.textTertiary} />
      <Text style={styles.muted}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: ADMIN_COLORS.dangerBg,
  },
  errorText: { flex: 1, minWidth: 160, fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  muted: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
})
