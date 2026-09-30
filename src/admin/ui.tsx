import type { ComponentProps, ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'

/** 관리자 화면 공통 부품. 앱 화면과 섞이지 않게 이 폴더 안에서만 쓴다. */

export const ADMIN_COLORS = {
  ...COLORS,
  pageBg: '#F5F6F8',
  sidebarBg: '#05014A',
  sidebarText: '#C9C8E6',
  success: '#15803D',
  successBg: '#DCFCE7',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  dangerBg: '#FEE2E2',
  neutralBg: '#F1F5F9',
  neutralText: '#475569',
  infoBg: '#E0E7FF',
  kakao: '#FEE500',
} as const

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const TONE_STYLE: Record<Tone, { bg: string; text: string }> = {
  neutral: { bg: ADMIN_COLORS.neutralBg, text: ADMIN_COLORS.neutralText },
  success: { bg: ADMIN_COLORS.successBg, text: ADMIN_COLORS.success },
  warning: { bg: ADMIN_COLORS.warningBg, text: ADMIN_COLORS.warning },
  danger: { bg: ADMIN_COLORS.dangerBg, text: COLORS.danger },
  info: { bg: ADMIN_COLORS.infoBg, text: COLORS.primary },
}

export function Badge({ label, tone = 'neutral', style }: { label: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const colors = TONE_STYLE[tone]
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
    </View>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  /** 진행 중이면 스피너를 보이고 누를 수 없게 한다. */
  loading?: boolean
  icon?: ComponentProps<typeof Ionicons>['name']
  small?: boolean
  style?: StyleProp<ViewStyle>
}

export function Button({ label, onPress, variant = 'secondary', disabled, loading, icon, small, style }: ButtonProps) {
  const inactive = disabled || loading
  const palette = BUTTON_PALETTE[variant]
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !inactive && styles.buttonPressed,
        inactive && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 14 : 16} color={palette.text} />
      ) : null}
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: palette.text }]}>{label}</Text>
    </Pressable>
  )
}

const BUTTON_PALETTE: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: COLORS.primary, text: COLORS.white, border: COLORS.primary },
  secondary: { bg: COLORS.white, text: COLORS.textPrimary, border: '#D4D4D8' },
  danger: { bg: COLORS.danger, text: COLORS.white, border: COLORS.danger },
  ghost: { bg: 'transparent', text: COLORS.primary, border: 'transparent' },
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  )
}

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

interface TabOption<T extends string> {
  value: T
  label: string
  count?: number
}

/** 상태 필터 탭. 좁은 화면에서는 줄바꿈된다. */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly TabOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{option.label}</Text>
            {option.count !== undefined && option.count > 0 ? (
              <View style={[styles.tabCount, selected && styles.tabCountSelected]}>
                <Text style={[styles.tabCountText, selected && styles.tabCountTextSelected]}>{option.count}</Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * 되돌릴 수 없는 작업 전의 확인 막대. window.confirm 대신 카드 안에 펼친다
 * (브라우저 대화상자는 자동화·스크린 리더에서 다루기 어렵고 화면 흐름을 끊는다).
 */
export function ConfirmBar({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  danger,
  children,
}: {
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  danger?: boolean
  children?: ReactNode
}) {
  return (
    <View style={[styles.confirm, danger && styles.confirmDanger]}>
      <Text style={styles.confirmText}>{message}</Text>
      {children}
      <View style={styles.confirmActions}>
        <Button label="취소" onPress={onCancel} disabled={busy} small />
        <Button label={confirmLabel} onPress={onConfirm} loading={busy} variant={danger ? 'danger' : 'primary'} small />
      </View>
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

export const adminText = StyleSheet.create({
  body: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPrimary, lineHeight: 21 },
  muted: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  strong: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
})

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontFamily: FONTS.semibold, fontSize: 12 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonSmall: { paddingHorizontal: 10, paddingVertical: 6 },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: FONTS.semibold, fontSize: 14 },
  buttonTextSmall: { fontSize: 13 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
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
  headerTitle: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.textPrimary },
  headerSubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: ADMIN_COLORS.dangerBg,
  },
  errorText: { flex: 1, minWidth: 160, fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  muted: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    backgroundColor: COLORS.white,
  },
  tabSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  tabTextSelected: { color: COLORS.white },
  tabCount: { minWidth: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: ADMIN_COLORS.dangerBg, alignItems: 'center' },
  tabCountSelected: { backgroundColor: COLORS.white },
  tabCountText: { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.danger, lineHeight: 18 },
  tabCountTextSelected: { color: COLORS.primary },
  confirm: {
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: ADMIN_COLORS.infoBg,
  },
  confirmDanger: { backgroundColor: ADMIN_COLORS.dangerBg },
  confirmText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary, lineHeight: 19 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  labelValue: { gap: 2 },
  label: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  value: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.textPrimary },
})
