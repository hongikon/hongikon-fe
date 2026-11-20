import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { MAX_DWELL_MINUTES, MIN_DWELL_MINUTES } from '../../../lib/nearbyPartners/rules'
import { stepDwell } from '../../../utils/settings/nearby'
import Button from '../../common/Button'
import { nearbyStyles as styles } from './styles'

/** "카페  −  2분  +" 한 줄. 1~10분, 바꾸면 바로 저장한다. */
export function DwellStepper({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (minutes: number) => void }) {
  const step = (delta: number) => onChange(stepDwell(value, delta))
  return (
    <View
      style={styles.settingRow}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} 알림까지 머무는 시간`}
      accessibilityValue={{ text: `${value}분` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <Text style={[styles.settingLabel, styles.settingText]}>{label}</Text>
      <Pressable
        onPress={() => step(-1)}
        disabled={disabled || value <= MIN_DWELL_MINUTES}
        style={[styles.stepButton, value <= MIN_DWELL_MINUTES && styles.stepButtonOff]}
        hitSlop={6}
      >
        <Ionicons name="remove" size={18} color={COLORS.primary} />
      </Pressable>
      <Text style={styles.stepValue}>{value}분</Text>
      <Pressable
        onPress={() => step(1)}
        disabled={disabled || value >= MAX_DWELL_MINUTES}
        style={[styles.stepButton, value >= MAX_DWELL_MINUTES && styles.stepButtonOff]}
        hitSlop={6}
      >
        <Ionicons name="add" size={18} color={COLORS.primary} />
      </Pressable>
    </View>
  )
}

/** 점검표 한 줄: 됐으면 초록 체크, 아니면 주황 느낌표 + 고치기 버튼. */
export function CheckRow({
  ok,
  label,
  hint,
  fixLabel,
  onFix,
  last,
}: {
  ok: boolean
  label: string
  hint?: string
  fixLabel?: string
  onFix?: () => void
  last?: boolean
}) {
  return (
    <View style={[styles.settingRow, !last && styles.rowDivider]} accessible={!onFix || ok} accessibilityLabel={`${label} ${ok ? '됨' : '필요'}`}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'alert-circle'}
        size={20}
        color={ok ? COLORS.success : COLORS.warningIcon}
      />
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        {!ok && hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {!ok && fixLabel && onFix ? <Button label={fixLabel} variant="secondary" size="sm" onPress={onFix} /> : null}
    </View>
  )
}
