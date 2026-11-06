import { Pressable, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import type { SaveState } from '../../utils/pathSurveyV3/transfer'
import { Btn, TOUCH } from '../pathSurvey/ui'

export const clockText = (at: number) => {
  const d = new Date(at)
  const two = (n: number) => String(n).padStart(2, '0')
  const today = new Date()
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  return `${sameDay ? '' : `${d.getMonth() + 1}/${d.getDate()} `}${two(d.getHours())}:${two(d.getMinutes())}`
}

/** Always visible: save button with its state, error count and undo. */
export default function SaveBar({
  state,
  lastSaveAt,
  errors,
  warnings,
  onSave,
  onUndo,
  onShowCheck,
}: {
  state: SaveState
  lastSaveAt: number | null
  errors: number
  warnings: number
  onSave: () => void
  onUndo: () => void
  onShowCheck: () => void
}) {
  const status =
    state === 'saved' && lastSaveAt ? `저장됨 ${clockText(lastSaveAt)}` : state === 'needed' && lastSaveAt ? `저장 필요 (마지막 ${clockText(lastSaveAt)})` : '저장 필요 (저장한 적 없음)'
  return (
    <View style={styles.row}>
      <Pressable onPress={onSave} style={styles.save} accessibilityRole="button" accessibilityLabel="저장">
        <Text style={styles.saveText}>{'저장'}</Text>
      </Pressable>
      <Text style={[styles.status, state !== 'saved' && styles.statusNeeded]} numberOfLines={2}>
        {status}
      </Text>
      <Pressable onPress={onShowCheck} style={[styles.badge, errors > 0 ? styles.badgeError : styles.badgeOk]} accessibilityRole="button">
        <Text style={styles.badgeText}>{`오류 ${errors}`}</Text>
        {warnings > 0 ? <Text style={styles.badgeSub}>{`경고 ${warnings}`}</Text> : null}
      </Pressable>
      <Btn label="되돌리기" onPress={onUndo} style={styles.undo} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  save: { minHeight: TOUCH, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: FONTS.bold, fontSize: 14, color: '#FFFFFF' },
  status: { flex: 1, fontFamily: FONTS.medium, fontSize: 12, color: '#15803D' },
  statusNeeded: { color: '#B45309' },
  badge: { minHeight: TOUCH, minWidth: 56, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeError: { backgroundColor: '#DC2626' },
  badgeOk: { backgroundColor: '#15803D' },
  badgeText: { fontFamily: FONTS.bold, fontSize: 12, color: '#FFFFFF' },
  badgeSub: { fontFamily: FONTS.regular, fontSize: 10, color: '#FFFFFF' },
  undo: { flexGrow: 0, backgroundColor: COLORS.fill },
})
