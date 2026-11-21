import type { ComponentProps } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton, { type ButtonVariant as AppButtonVariant } from '../../components/common/Button'
import { COLORS } from '../../constants/colors'
import { RADIUS } from '../../constants/spacing'
import { FONTS } from '../../constants/typography'
import { useAdminHost } from './host'

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

const APP_VARIANT: Record<ButtonVariant, AppButtonVariant> = {
  primary: 'primary',
  secondary: 'outline',
  danger: 'destructive',
  ghost: 'ghost',
}

export function Button({ label, onPress, variant = 'secondary', disabled, loading, icon, small, style }: ButtonProps) {
  const host = useAdminHost()
  if (host === 'app') {
    // 폰에서는 작은 버튼도 터치 최소 크기(44)를 지킨다.
    return (
      <AppButton
        label={label}
        onPress={onPress}
        variant={APP_VARIANT[variant]}
        size="md"
        icon={icon}
        disabled={disabled}
        loading={loading}
        fullWidth={false}
        style={style}
      />
    )
  }
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

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  buttonSmall: { paddingHorizontal: 10, paddingVertical: 6 },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: FONTS.semibold, fontSize: 14 },
  buttonTextSmall: { fontSize: 13 },
})
