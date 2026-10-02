import { forwardRef } from 'react'
import type React from 'react'
import { Animated, Platform, StyleSheet, Text, TextInput, type StyleProp, type TextInputProps, type TextStyle } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import { CONTROL_HEIGHT, RADIUS, SPACING } from '../../constants/spacing'
import { useAttentionFlash } from '../../hooks/useAttentionFlash'

interface TextFieldProps extends TextInputProps {
  /** 여러 줄 입력칸의 높이 */
  areaHeight?: number
  /**
   * 필수 칸을 비운 채 제출했을 때 시선을 끄는 효과. 값이 바뀔 때마다(0 은 무시) 테두리가 빨갛게 됐다가
   * 원래 색으로 돌아오고 좌우로 살짝 흔들린다. `invalid` 가 false 가 되면 바로 멈춘다.
   * 둘 다 넘기지 않는 화면은 지금처럼 평범한 TextInput 을 그린다.
   */
  flashKey?: number
  /** 지금 값이 필수 조건을 못 채웠는지. `flashKey` 효과가 이 동안만 이어진다. */
  invalid?: boolean
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

/**
 * 앱 공용 입력칸. 흰 바탕 + 옅은 테두리, 높이 46, 모서리 12, 글자 15 로 문의·닉네임·정보 제보·제보 작성이 같은 모양을 쓴다.
 * placeholder 색도 여기서 정해 화면마다 다르게 옅어지지 않게 한다.
 */
const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { style, multiline, areaHeight = 120, placeholderTextColor, flashKey, invalid, ...rest },
  ref,
) {
  const common = {
    multiline,
    textAlignVertical: multiline ? ('top' as const) : ('center' as const),
    placeholderTextColor: placeholderTextColor ?? COLORS.textPlaceholder,
    ...rest,
  }
  const baseStyle = [styles.input, multiline ? [styles.area, { height: areaHeight }] : styles.single, style]
  if (flashKey === undefined && invalid === undefined) {
    return <TextInput ref={ref} {...common} style={baseStyle} />
  }
  return <FlashingTextInput ref={ref} {...common} baseStyle={baseStyle} flashKey={flashKey} invalid={invalid ?? false} />
})

const FlashingTextInput = forwardRef<
  TextInput,
  TextInputProps & { baseStyle: StyleProp<TextStyle>; flashKey: number | undefined; invalid: boolean }
>(function FlashingTextInput({ baseStyle, flashKey, invalid, ...rest }, ref) {
  // 바깥에서 테두리 색을 바꿨으면 그 색으로 돌아온다.
  const resolvedBorder = (StyleSheet.flatten(baseStyle)?.borderColor as string | undefined) ?? COLORS.border
  const flash = useAttentionFlash(flashKey, invalid, resolvedBorder)
  // 웹은 포커스 테두리(outline)가 빨간 테두리를 덮는다 — 아직 비어 있는 동안엔 포커스 테두리도 빨갛게 둔다.
  const webErrorOutline = Platform.OS === 'web' && invalid && flashKey ? styles.webErrorOutline : null
  return <AnimatedTextInput ref={ref} {...rest} style={[baseStyle, flash, webErrorOutline]} />
})

export default TextField

export const FIELD_HEIGHT = CONTROL_HEIGHT.md + 2

const styles = StyleSheet.create({
  input: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  single: { height: FIELD_HEIGHT },
  area: { paddingTop: SPACING.md, paddingBottom: SPACING.md },
  webErrorOutline: { outlineColor: COLORS.danger },
})

/** 입력칸 위 이름. 문의·닉네임·정보 제보·제보 작성이 같은 크기·색을 쓴다. */
export function FieldLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[labelStyles.label, style]}>{children}</Text>
}

const labelStyles = StyleSheet.create({
  label: { ...TYPE.section, color: COLORS.textPrimary, marginBottom: SPACING.sm },
})
