import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { COLORS } from '../../constants/colors'
import { RADIUS } from '../../constants/spacing'
import { FONTS } from '../../constants/typography'
import { useAdminHost } from './host'

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const app = useAdminHost() === 'app'
  return (
    <View style={[styles.header, app && styles.headerApp]}>
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, app && styles.headerTitleApp]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  )
}

export function LabelValue({ label, value, valueStyle }: { label: string; value: ReactNode; valueStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={styles.labelValue}>
      <Text style={styles.label}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={[styles.value, valueStyle]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  headerText: { flexShrink: 1, gap: 4 },
  headerApp: { alignItems: 'flex-start', marginBottom: 12 },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.textPrimary },
  headerTitleApp: { fontSize: 18 },
  headerSubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelValue: { gap: 2 },
  label: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  value: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.textPrimary },
})
