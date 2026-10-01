import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'

interface ButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  accessibilityHint?: string
}

/** 온보딩 하단의 꽉 찬 버튼. `tone="soft"` 는 "나중에 할게요"처럼 넘어가기만 하는 버튼에 쓴다. */
export function OnboardingPrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  accessibilityHint,
  tone = 'solid',
}: ButtonProps & { tone?: 'solid' | 'soft' }) {
  const soft = tone === 'soft'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primary,
        soft && styles.primarySoft,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
    >
      {loading ? (
        <ActivityIndicator color={soft ? COLORS.primary : COLORS.white} />
      ) : (
        <Text style={[styles.primaryText, soft && styles.primaryTextSoft]}>{label}</Text>
      )}
    </Pressable>
  )
}

/** 큰 버튼 아래의 가벼운 글자 버튼(나중에·건너뛰기). */
export function OnboardingTextButton({ label, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.text, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.textLabel}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  primary: {
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primarySoft: { backgroundColor: '#F2F2F6' },
  primaryText: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.white },
  primaryTextSoft: { color: '#4B4B5C' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.4 },
  text: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  textLabel: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
})
