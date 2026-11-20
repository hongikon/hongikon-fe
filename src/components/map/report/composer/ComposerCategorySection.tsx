import type { RefObject } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../../constants/colors'
import { REPORT_CUSTOM_CATEGORY_MAX_LENGTH } from '../../../../constants/report'
import { REPORT_CATEGORIES } from '../../../../constants/reportCategories'
import type { ReportCategory } from '../../../../types'
import TextField from '../../../common/TextField'
import { chipStyles } from '../../chipStyles'
import { composerStyles } from './composerStyles'

interface ComposerCategorySectionProps {
  /** '무슨 일인가요?' 라벨. 빠진 칸으로 스크롤할 때 위치를 잰다. */
  labelRef: RefObject<Text | null>
  /** 직접 입력 칸. 빠진 채 올리려 하면 포커스를 준다. */
  customInputRef: RefObject<TextInput | null>
  category: ReportCategory
  isCustomActive: boolean
  trimmedCustomLabel: string
  customInputOpen: boolean
  customLabelDraft: string
  onChangeCustomLabelDraft: (value: string) => void
  /** 깜빡임 번호(`useRequiredFieldFlash`). */
  flashKey: number | undefined
  /** 깜빡인 뒤에도 빠져 있으면 보이는 안내. */
  flaggedMessage: string | null
  onSelectPreset: (key: ReportCategory) => void
  onOpenCustomInput: () => void
  onConfirmCustomLabel: () => void
  onCancelCustomInput: () => void
}

/** 제보 작성창의 카테고리: 프리셋 칩과 '직접 입력' 칩, 직접 입력 칸(✓ 로 확정·✕ 로 취소). */
export default function ComposerCategorySection({
  labelRef,
  customInputRef,
  category,
  isCustomActive,
  trimmedCustomLabel,
  customInputOpen,
  customLabelDraft,
  onChangeCustomLabelDraft,
  flashKey,
  flaggedMessage,
  onSelectPreset,
  onOpenCustomInput,
  onConfirmCustomLabel,
  onCancelCustomInput,
}: ComposerCategorySectionProps) {
  return (
    <>
      <Text ref={labelRef} style={composerStyles.sectionLabel}>
        무슨 일인가요?
      </Text>
      <View style={styles.chipWrap}>
        {REPORT_CATEGORIES.map((meta) => {
          const isActive = category === meta.key && !isCustomActive
          return (
            <TouchableOpacity
              key={meta.key}
              activeOpacity={0.75}
              onPress={() => onSelectPreset(meta.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={meta.label}
              style={[
                chipStyles.chip,
                isActive && { backgroundColor: meta.color, borderColor: meta.color },
              ]}
            >
              <Ionicons
                name={meta.icon}
                size={13}
                color={isActive ? COLORS.white : meta.color}
              />
              <Text style={[chipStyles.label, isActive && chipStyles.labelActive]}>
                {meta.label}
              </Text>
            </TouchableOpacity>
          )
        })}

        {!customInputOpen && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onOpenCustomInput}
            accessibilityRole="button"
            accessibilityState={{ selected: isCustomActive }}
            accessibilityLabel={
              isCustomActive ? `${trimmedCustomLabel}, 직접 입력한 카테고리` : '카테고리 직접 입력'
            }
            style={[
              chipStyles.chip,
              isCustomActive
                ? styles.customChipActive
                : styles.customChipAdd,
            ]}
          >
            <Ionicons
              name={isCustomActive ? 'pencil' : 'add'}
              size={13}
              color={isCustomActive ? COLORS.white : COLORS.primary}
            />
            <Text
              style={[
                chipStyles.label,
                isCustomActive ? chipStyles.labelActive : styles.customChipAddText,
              ]}
            >
              {isCustomActive ? trimmedCustomLabel : '직접 입력'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {customInputOpen && (
        <View style={styles.customInputRow}>
          <TextField
            ref={customInputRef}
            flashKey={flashKey}
            invalid={customInputOpen}
            style={styles.customInput}
            placeholder="예: 분실물, 설문조사"
            accessibilityLabel="직접 입력할 카테고리"
            value={customLabelDraft}
            onChangeText={onChangeCustomLabelDraft}
            maxLength={REPORT_CUSTOM_CATEGORY_MAX_LENGTH}
            autoFocus
            onSubmitEditing={onConfirmCustomLabel}
            returnKeyType="done"
          />
          <TouchableOpacity
            onPress={onConfirmCustomLabel}
            disabled={!customLabelDraft.trim()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="직접 입력한 카테고리 적용"
            accessibilityState={{ disabled: !customLabelDraft.trim() }}
          >
            <Ionicons
              name="checkmark-circle"
              size={26}
              color={customLabelDraft.trim() ? COLORS.primary : COLORS.iconMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onCancelCustomInput}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="직접 입력 취소"
          >
            <Ionicons name="close-circle" size={26} color={COLORS.iconMuted} />
          </TouchableOpacity>
        </View>
      )}
      {flaggedMessage !== null && (
        <Text style={composerStyles.fieldHint}>{flaggedMessage}</Text>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  customChipAdd: { borderStyle: 'dashed', borderColor: COLORS.primary },
  customChipAddText: { color: COLORS.primary },
  customChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  customInput: { flex: 1, minWidth: 0, height: 40, fontSize: 14 },
})
