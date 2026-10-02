import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { CONTROL_HEIGHT, RADIUS, SPACING } from '../../constants/spacing'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  label: string
  onPress: () => void
  /**
   * - primary: 화면의 주된 행동(보내기·저장·확인). 한 화면에 하나만.
   * - secondary: 옅은 브랜드 바탕. 주된 행동 옆의 보조 행동(원문 보기·설정 열기).
   * - outline: 테두리만. 목록 안에서 반복되는 작은 행동(지도에서 위치 찍기).
   * - ghost: 글자만. 건너뛰기·지우기처럼 가벼운 행동.
   * - destructive: 되돌릴 수 없는 행동(탈퇴 등). 빨간 글자.
   */
  variant?: ButtonVariant
  /** lg 48(화면 하단 주 버튼) · md 44(카드 안) · sm 36(줄 안·작은 행동) */
  size?: ButtonSize
  icon?: keyof typeof Ionicons.glyphMap
  /** 아이콘을 글자 뒤에 둔다(바깥으로 나가는 링크의 open-outline 등). */
  iconPosition?: 'left' | 'right'
  disabled?: boolean
  loading?: boolean
  /** 기본은 부모 너비를 꽉 채운다. false 면 글자 길이만큼만 차지한다. */
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  accessibilityHint?: string
  accessibilityRole?: 'button' | 'link'
  /** 글자 대신 넣을 내용(드물게). */
  children?: ReactNode
}

const HEIGHT = { sm: CONTROL_HEIGHT.sm, md: CONTROL_HEIGHT.md, lg: CONTROL_HEIGHT.lg } as const
const FONT_SIZE = { sm: 13, md: 14, lg: 15 } as const
const ICON = { sm: 14, md: 16, lg: 17 } as const

const PALETTE: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: COLORS.primary, fg: COLORS.white },
  secondary: { bg: COLORS.primarySoft, fg: COLORS.primary },
  outline: { bg: COLORS.white, fg: COLORS.primary, border: COLORS.primary },
  ghost: { bg: 'transparent', fg: COLORS.textSecondary },
  destructive: { bg: COLORS.dangerSoft, fg: COLORS.danger },
}

/**
 * 앱 공용 버튼. 화면마다 높이·모서리·글자 크기가 달라지지 않게 모든 꽉 찬 버튼은 이걸 쓴다.
 * 로딩 중엔 글자 자리에 스피너를 띄우고 누를 수 없게 한다(보조기기에도 busy 로 알린다).
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  children,
}: ButtonProps) {
  const palette = PALETTE[variant]
  const inactive = disabled || loading
  const iconNode = icon ? <Ionicons name={icon} size={ICON[size]} color={palette.fg} /> : null

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      hitSlop={size === 'sm' ? 4 : undefined}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: size === 'sm' ? SPACING.md : SPACING.lg,
          borderRadius: size === 'sm' ? RADIUS.pill : RADIUS.md,
          backgroundColor: palette.bg,
        },
        palette.border !== undefined && { borderWidth: 1, borderColor: palette.border },
        fullWidth ? styles.full : styles.hug,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        children ?? (
          <>
            {iconPosition === 'left' && iconNode}
            <Text style={[styles.label, { fontSize: FONT_SIZE[size], color: palette.fg }]} numberOfLines={1}>
              {label}
            </Text>
            {iconPosition === 'right' && iconNode}
          </>
        )
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  full: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  label: { fontFamily: FONTS.semibold },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
})
