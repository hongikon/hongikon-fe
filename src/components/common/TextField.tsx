import { forwardRef } from 'react'
import type React from 'react'
import { StyleSheet, Text, TextInput, type StyleProp, type TextInputProps, type TextStyle } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import { CONTROL_HEIGHT, RADIUS, SPACING } from '../../constants/spacing'

interface TextFieldProps extends TextInputProps {
  /** 여러 줄 입력칸의 높이 */
  areaHeight?: number
}

/**
 * 앱 공용 입력칸. 흰 바탕 + 옅은 테두리, 높이 46, 모서리 12, 글자 15 로 문의·닉네임·제휴 제보·제보 작성이 같은 모양을 쓴다.
 * placeholder 색도 여기서 정해 화면마다 다르게 옅어지지 않게 한다.
 */
const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { style, multiline, areaHeight = 120, placeholderTextColor, ...rest },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      placeholderTextColor={placeholderTextColor ?? COLORS.textPlaceholder}
      style={[styles.input, multiline ? [styles.area, { height: areaHeight }] : styles.single, style]}
      {...rest}
    />
  )
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
})

/** 입력칸 위 이름. 문의·닉네임·제휴 제보·제보 작성이 같은 크기·색을 쓴다. */
export function FieldLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[labelStyles.label, style]}>{children}</Text>
}

const labelStyles = StyleSheet.create({
  label: { ...TYPE.section, color: COLORS.textPrimary, marginBottom: SPACING.sm },
})
