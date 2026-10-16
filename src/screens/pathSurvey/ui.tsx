import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'

/** 현장에서 폰으로 누르기 쉬운 최소 높이. */
export const TOUCH = 44

type BtnKind = 'default' | 'primary' | 'danger' | 'active'

export function Btn({
  label,
  onPress,
  kind = 'default',
  disabled,
  style,
}: {
  label: string
  onPress: () => void
  kind?: BtnKind
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[ui.btn, kind === 'primary' && ui.btnPrimary, kind === 'danger' && ui.btnDanger, kind === 'active' && ui.btnActive, disabled && ui.btnDisabled, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={[ui.btnText, (kind === 'primary' || kind === 'active') && ui.btnTextOn, kind === 'danger' && ui.btnTextDanger]}>{label}</Text>
    </Pressable>
  )
}

export function Check({ label, checked, onToggle, color }: { label: string; checked: boolean; onToggle: () => void; color?: string }) {
  return (
    <Pressable onPress={onToggle} style={ui.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[ui.check, checked && { backgroundColor: color ?? '#2563EB', borderColor: color ?? '#2563EB' }]} />
      <Text style={ui.rowText}>{label}</Text>
    </Pressable>
  )
}

export function Section({ title, help, children }: { title: string; help?: string; children?: ReactNode }) {
  return (
    <View style={ui.section}>
      <Text style={ui.sectionTitle}>{title}</Text>
      {help ? <Text style={ui.sectionHelp}>{help}</Text> : null}
      {children}
    </View>
  )
}

export const Row = ({ children }: { children: ReactNode }) => <View style={ui.btnRow}>{children}</View>

/** 웹 확인창. 없으면(네이티브) 진행한다 — 이 화면은 웹 전용이다. */
export function confirmAction(message: string): boolean {
  const w = globalThis as any
  return typeof w.confirm === 'function' ? !!w.confirm(message) : true
}

/** 지점 id 를 짧게: 'mabc12-n7' → 'n7'. 다른 모양은 그대로. */
export const shortId = (id: string) => {
  const i = id.lastIndexOf('-')
  return i > 0 ? id.slice(i + 1) : id
}

export const ui = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 13.5, color: COLORS.textPrimary },
  sectionHelp: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textTertiary },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  empty: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textTertiary },
  rowText: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  warn: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#B45309' },
  error: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#DC2626' },
  btnRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  btn: {
    flexGrow: 1,
    minHeight: TOUCH,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: '#05014A' },
  btnActive: { backgroundColor: '#05014A' },
  btnDanger: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#DC2626' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  btnTextOn: { color: '#FFFFFF', fontFamily: FONTS.semibold },
  btnTextDanger: { color: '#DC2626' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH },
  check: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.border },
  input: {
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  memoInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlignVertical: 'top',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: TOUCH,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listRowOn: { borderColor: '#05014A', backgroundColor: '#EEF0FA' },
  swatch: { width: 16, height: 16, borderRadius: 8 },
})
