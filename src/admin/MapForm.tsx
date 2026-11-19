import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native'
import { ApiError, getErrorMessage } from '../apis/client'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { isAdminMapMissing } from './api'
import { Button, useAdminHost } from './ui'
import { RADIUS } from '../constants/spacing'

/**
 * 제휴업체·편의시설 관리 화면이 함께 쓰는 입력 부품과 검증 도우미.
 * 검증 규칙은 서버(지도 데이터 계약)와 같게 맞춰, 보내기 전에 화면에서 먼저 알려 준다. 서버도 같은 규칙으로 한 번 더 막는다.
 * 순수 검증 함수는 utils/mapFormRules.ts 에 있고 여기서 다시 내보낸다.
 */

export { LAT_RANGE, LNG_RANGE, optional, parseCoordinate, tooLong } from './utils/mapFormRules'

/** 저장·삭제 실패 문구. 서버가 준 짧은 안내(검증 실패·중복 등)가 있으면 그걸 보여 준다. */
export function mapWriteErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.serverMessage) return error.serverMessage
  if (error instanceof ApiError && error.status === 409) return '같은 코드가 이미 있어요. 다른 코드를 쓰거나 비워 두세요.'
  if (isAdminMapMissing(error)) return '서버에 지도 관리 기능이 아직 배포되지 않았습니다.'
  return getErrorMessage(error, fallback)
}

export function mapLoadErrorMessage(error: unknown, fallback: string): string {
  if (isAdminMapMissing(error)) return '서버에 지도 관리 기능이 아직 배포되지 않았습니다.'
  return getErrorMessage(error, fallback)
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

export function TextRow({
  value,
  onChangeText,
  placeholder,
  maxLength,
  keyboardType,
  multiline,
  editable = true,
  accessibilityLabel,
}: {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  maxLength?: number
  keyboardType?: KeyboardTypeOptions
  multiline?: boolean
  editable?: boolean
  accessibilityLabel: string
}) {
  const app = useAdminHost() === 'app'
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textPlaceholder}
      maxLength={maxLength}
      keyboardType={keyboardType}
      multiline={multiline}
      editable={editable}
      autoCapitalize="none"
      autoCorrect={false}
      accessibilityLabel={accessibilityLabel}
      style={[styles.input, app && styles.inputApp, multiline && styles.inputMultiline, !editable && styles.inputDisabled]}
    />
  )
}

/** 하나 또는 여러 개를 고르는 알약 버튼 줄. */
export function OptionChips<T extends string>({
  options,
  isSelected,
  onToggle,
  accessibilityLabel,
}: {
  options: readonly T[]
  isSelected: (value: T) => boolean
  onToggle: (value: T) => void
  accessibilityLabel: string
}) {
  const app = useAdminHost() === 'app'
  return (
    <View style={styles.chips} accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = isSelected(option)
        return (
          <Pressable
            key={option}
            onPress={() => onToggle(option)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            hitSlop={app ? 4 : undefined}
            style={[styles.chip, app && styles.chipApp, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** 폼 검증·저장 오류 목록. 없으면 아무것도 그리지 않는다. */
export function FormErrors({ errors }: { errors: readonly string[] }) {
  if (!errors.length) return null
  return (
    <View style={formStyles.errors} accessibilityRole="alert">
      {errors.map((message) => (
        <Text key={message} style={formStyles.errorText}>
          {message}
        </Text>
      ))}
    </View>
  )
}

/** 폼 맨 아래 '취소'·'저장' 버튼 줄. */
export function FormActions({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <View style={formStyles.actions}>
      <Button label="취소" onPress={onCancel} disabled={saving} small />
      <Button label="저장" variant="primary" onPress={onSave} loading={saving} small />
    </View>
  )
}

export const formStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  half: { flex: 1, minWidth: 160 },
  errors: { gap: 4 },
  errorText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
})

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  input: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputApp: { minHeight: 44, fontSize: 16 },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  inputDisabled: { backgroundColor: '#F4F4F5', color: COLORS.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    backgroundColor: COLORS.white,
  },
  chipApp: { minHeight: 36, justifyContent: 'center' },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  chipTextSelected: { color: COLORS.white },
})
