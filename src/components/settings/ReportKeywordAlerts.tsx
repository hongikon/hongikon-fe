import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import { RADIUS, SPACING } from '../../constants/spacing'
import type { NewReportsScope } from '../../apis/notificationSettings'
import { MAX_REPORT_KEYWORD_LENGTH, MAX_REPORT_KEYWORDS, type ReportKeyword } from '../../apis/reportKeywords'
import { isPendingKeyword, type ReportKeywordAlertsStatus } from '../../hooks/useReportKeywordAlerts'
import Button from '../common/Button'
import TextField from '../common/TextField'

interface ReportKeywordAlertsProps {
  status: ReportKeywordAlertsStatus
  scope: NewReportsScope
  keywords: ReportKeyword[]
  onRetry: () => void
  onChangeScope: (scope: NewReportsScope) => void
  onAdd: (keyword: string) => Promise<boolean>
  onRemove: (item: ReportKeyword) => void
}

const SCOPE_OPTIONS: { value: NewReportsScope; label: string; description: string }[] = [
  { value: 'CAMPUS', label: '전체 제보', description: '캠퍼스 새 제보를 30분에 한 번 모아서 알려드려요' },
  {
    value: 'KEYWORDS',
    label: '내 키워드가 들어간 제보만',
    description: '아래 키워드가 들어간 제보가 올라오면 바로 알려드려요',
  },
]

/**
 * 설정 > 알림 > 캠퍼스 새 제보 알림 바로 아래(로그인 + 스위치 켜짐일 때만). 받을 제보 범위와 제보 전용 키워드를 고른다.
 * 공지 키워드(설정 > 구독 게시판 > 키워드 알림)와 따로 저장한다. 상태와 요청은 `useReportKeywordAlerts` 가 맡는다.
 */
export default function ReportKeywordAlerts({
  status,
  scope,
  keywords,
  onRetry,
  onChangeScope,
  onAdd,
  onRemove,
}: ReportKeywordAlertsProps) {
  const [input, setInput] = useState('')

  if (status === 'unsupported') {
    return (
      <View style={styles.panel}>
        <View style={styles.notReady}>
          <Ionicons name="pricetag-outline" size={15} color={COLORS.textTertiary} />
          <Text style={styles.notReadyText}>제보 키워드 알림은 준비 중이에요</Text>
        </View>
      </View>
    )
  }

  if (status === 'loading') {
    return (
      <View style={[styles.panel, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  if (status === 'error') {
    return (
      <View style={[styles.panel, styles.center]}>
        <Text style={styles.errorText}>제보 키워드 설정을 불러오지 못했어요</Text>
        <Button label="다시 시도" variant="secondary" size="sm" fullWidth={false} onPress={onRetry} />
      </View>
    )
  }

  const trimmed = input.trim()
  const duplicate = trimmed.length > 0 && keywords.some((k) => k.keyword.toLowerCase() === trimmed.toLowerCase())
  const full = keywords.length >= MAX_REPORT_KEYWORDS
  const canAdd = trimmed.length > 0 && !duplicate && !full

  const handleAdd = () => {
    if (!canAdd) return
    const value = trimmed
    // 낙관적으로 목록에 먼저 넣고 입력칸을 비운다. 실패하면 입력값을 되살려 다시 보낼 수 있게 한다.
    setInput('')
    void onAdd(value).then((ok) => {
      if (!ok) setInput((current) => (current === '' ? value : current))
    })
  }

  const hint = duplicate
    ? '이미 등록한 키워드예요'
    : full
      ? `제보 키워드는 ${MAX_REPORT_KEYWORDS}개까지 등록할 수 있어요`
      : scope === 'KEYWORDS'
        ? '이 단어가 들어간 새 제보가 올라오면 바로 알려드려요'
        : "'내 키워드가 들어간 제보만'을 고르면 키워드가 들어간 제보만 받아요"

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>받을 제보</Text>
      <View style={styles.scopeList} accessibilityRole="radiogroup">
        {SCOPE_OPTIONS.map((option) => {
          const selected = scope === option.value
          return (
            <Pressable
              key={option.value}
              onPress={() => onChangeScope(option.value)}
              style={({ pressed }) => [
                styles.scopeOption,
                selected && styles.scopeOptionOn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.label}, ${option.description}`}
            >
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={selected ? COLORS.primary : COLORS.iconMuted}
              />
              <View style={styles.scopeBody}>
                <Text style={[styles.scopeLabel, selected && styles.scopeLabelOn]}>{option.label}</Text>
                <Text style={styles.scopeDescription}>{option.description}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.keywordHeader}>
        <Text style={styles.label}>제보 키워드</Text>
        <Text style={styles.count}>
          {keywords.length}/{MAX_REPORT_KEYWORDS}
        </Text>
      </View>
      <View style={styles.inputRow}>
        <TextField
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="예: 간식, 붕어빵, 중고책"
          maxLength={MAX_REPORT_KEYWORD_LENGTH}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          accessibilityLabel="알림 받을 제보 키워드"
        />
        <Button
          label="추가"
          size="md"
          fullWidth={false}
          onPress={handleAdd}
          disabled={!canAdd}
          accessibilityLabel="제보 키워드 추가"
          style={styles.addBtn}
        />
      </View>
      <Text style={[styles.hint, (duplicate || full) && styles.hintWarn]}>{hint}</Text>

      {keywords.length === 0 ? (
        <Text style={styles.empty}>등록한 제보 키워드가 없어요. 예: 간식, 붕어빵, 중고책</Text>
      ) : (
        <View style={styles.chips}>
          {keywords.map((item) => {
            const pending = isPendingKeyword(item)
            return (
              <View key={item.id} style={[styles.chip, pending && styles.chipPending]}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {item.keyword}
                </Text>
                {pending ? (
                  <ActivityIndicator size="small" color={COLORS.primary} style={styles.chipSpinner} />
                ) : (
                  <TouchableOpacity
                    onPress={() => onRemove(item)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.keyword} 제보 키워드 지우기`}
                  >
                    <Ionicons name="close-circle" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )
          })}
        </View>
      )}

      {scope === 'KEYWORDS' && keywords.length === 0 && (
        <View style={styles.warnBox} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.warningIcon} />
          <Text style={styles.warnText}>키워드를 추가하기 전까지는 새 제보 알림이 오지 않아요.</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.sm },
  center: { alignItems: 'center', paddingTop: SPACING.sm },
  notReady: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingTop: SPACING.xs },
  notReadyText: { ...TYPE.caption, color: COLORS.textTertiary },
  errorText: { ...TYPE.callout, color: COLORS.textSecondary },
  label: { ...TYPE.label, color: COLORS.textSecondary },
  scopeList: { gap: SPACING.sm, marginBottom: SPACING.sm },
  scopeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  scopeOptionOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  pressed: { opacity: 0.75 },
  scopeBody: { flex: 1, gap: SPACING.xxs },
  scopeLabel: { ...TYPE.callout, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  scopeLabelOn: { color: COLORS.primary },
  scopeDescription: { ...TYPE.caption, color: COLORS.textSecondary },
  keywordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { ...TYPE.label, color: COLORS.textTertiary },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  input: { flex: 1 },
  addBtn: { minWidth: 64, height: 46 },
  hint: { ...TYPE.caption, color: COLORS.textSecondary },
  hintWarn: { color: COLORS.danger },
  empty: { ...TYPE.caption, color: COLORS.textTertiary, paddingVertical: SPACING.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    maxWidth: '100%',
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  chipPending: { opacity: 0.6 },
  chipText: { ...TYPE.callout, fontFamily: FONTS.medium, color: COLORS.primary, flexShrink: 1 },
  chipSpinner: { transform: [{ scale: 0.7 }] },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningSoft,
  },
  warnText: { ...TYPE.caption, flex: 1, color: COLORS.warning },
})
