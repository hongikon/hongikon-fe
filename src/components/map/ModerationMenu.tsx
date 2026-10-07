import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { REPORT_FLAG_REASONS } from '../../constants/report'
import type { ReportFlagReason } from '../../types'
import { RADIUS } from '../../constants/spacing'

interface ModerationMenuProps {
  visible: boolean
  onClose: () => void
  /** '제보' | '댓글' — 문구에 쓴다. */
  target: '제보' | '댓글'
  /** 작성자 숨기기(기기에만 저장, 게스트도 가능). authorKey 가 없으면(구서버) 메뉴에서 뺀다. */
  canHide: boolean
  onHide: () => void
  /** 이미 신고했으면 "신고 접수됨"으로 막는다. */
  flagged?: boolean
  /** 신고하기를 눌렀을 때. false 를 돌려주면(게스트 → 로그인 안내) 사유 단계로 가지 않는다. */
  beforeFlag: () => boolean
  onFlag: (reason: ReportFlagReason) => void
}

/**
 * 남의 제보·댓글의 ⋮ 메뉴: "이 사용자 숨기기" · "신고하기"(→ 사유 고르기). 화면 아래에서 올라오는 작은 시트.
 * 안드로이드 Alert 는 버튼이 3개까지라 사유 5개를 담을 수 없어 직접 그린다(웹도 같은 화면).
 */
export default function ModerationMenu({
  visible,
  onClose,
  target,
  canHide,
  onHide,
  flagged = false,
  beforeFlag,
  onFlag,
}: ModerationMenuProps) {
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<'menu' | 'reasons'>('menu')

  useEffect(() => {
    if (visible) setStep('menu')
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={menuStyles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="메뉴 닫기">
        <Pressable style={[menuStyles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} onPress={() => {}}>
          {step === 'menu' ? (
            <View accessibilityRole="menu">
              {canHide ? (
                <MenuRow
                  icon="eye-off-outline"
                  label="이 사용자 숨기기"
                  hint="이 사람의 제보와 댓글이 이 기기에서 보이지 않아요"
                  onPress={() => {
                    onClose()
                    onHide()
                  }}
                />
              ) : null}
              <MenuRow
                icon="flag-outline"
                label={flagged ? '신고 접수됨' : '신고하기'}
                hint={flagged ? '운영진이 확인하고 있어요' : `부적절한 ${target === '댓글' ? '댓글을' : '제보를'} 운영진에게 알려요`}
                danger={!flagged}
                disabled={flagged}
                onPress={() => {
                  if (!beforeFlag()) {
                    onClose()
                    return
                  }
                  setStep('reasons')
                }}
              />
            </View>
          ) : (
            <View accessibilityRole="radiogroup" accessibilityLabel={`${target} 신고 사유`}>
              <Text style={menuStyles.title}>신고 사유를 골라 주세요</Text>
              {REPORT_FLAG_REASONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={menuStyles.reason}
                  onPress={() => {
                    onClose()
                    onFlag(item.value)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label}(으)로 신고하기`}
                >
                  <Text style={menuStyles.reasonText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.chevron} />
                </TouchableOpacity>
              ))}
              <Text style={menuStyles.hint}>운영진이 확인한 뒤 조치해요. 신고가 쌓이면 바로 숨겨져요.</Text>
            </View>
          )}
          <TouchableOpacity style={menuStyles.cancel} onPress={onClose} accessibilityRole="button">
            <Text style={menuStyles.cancelText}>취소</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export function MenuRow({
  icon,
  label,
  hint,
  danger = false,
  disabled = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  hint: string
  danger?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[menuStyles.row, disabled && menuStyles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="menuitem"
      accessibilityState={{ disabled }}
    >
      <View style={[menuStyles.rowIcon, danger && menuStyles.rowIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? COLORS.danger : COLORS.textSecondary} />
      </View>
      <View style={menuStyles.rowText}>
        <Text style={[menuStyles.rowLabel, danger && menuStyles.rowLabelDanger]}>{label}</Text>
        <Text style={menuStyles.rowHint}>{hint}</Text>
      </View>
    </TouchableOpacity>
  )
}

export const menuStyles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.scrim },
  sheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8 },
  rowDisabled: { opacity: 0.55 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.fill,
  },
  rowIconDanger: { backgroundColor: COLORS.dangerSoft },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.textPrimary },
  rowLabelDanger: { color: COLORS.danger },
  rowHint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  title: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.textPrimary, marginTop: 4, marginBottom: 6 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  reasonText: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textPrimary },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginTop: 10 },
  cancel: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.fill,
  },
  cancelText: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.textSecondary },
})
