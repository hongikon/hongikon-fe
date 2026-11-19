import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../../constants/colors'
import { FONTS, TYPE } from '../../../../constants/typography'
import { formatClock, formatDay } from '../../../../utils/reportSchedule'
import Button from '../../../common/Button'

interface ComposerSuccessProps {
  /** 접수된 예정 제보의 시작(ms). 지금 시작이면 null. */
  submittedStartMs: number | null
  /** 서버에 사진 기능이 아직 없어 사진을 빼고 올렸는지. */
  photoSkipped: boolean
  onConfirm: () => void
}

/**
 * 등록 성공 화면. 바로 닫지 않고 "검토 후 반영" 안내를 먼저 보여준다 —
 * 올린 제보가 지도에 안 보이는 것을 실패로 오해하지 않게 하려는 것이다.
 */
export default function ComposerSuccess({ submittedStartMs, photoSkipped, onConfirm }: ComposerSuccessProps) {
  return (
    <View style={styles.successBox}>
      <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
      <Text style={styles.successTitle}>제보가 접수됐어요</Text>
      <Text style={styles.successText}>
        {submittedStartMs !== null
          ? `운영진이 확인하면 ${formatDay(submittedStartMs)} ${formatClock(submittedStartMs)}부터 지도에 보여요.`
          : '운영진이 확인한 뒤 지도에 올라가요.'}
        {'\n'}잘못된 정보나 광고는 올라가지 않을 수 있어요.
      </Text>
      {photoSkipped && (
        <Text style={styles.successText}>사진 첨부는 아직 준비 중이라 사진 없이 올렸어요.</Text>
      )}
      <Button label="확인" onPress={onConfirm} style={styles.successBtn} />
    </View>
  )
}

const styles = StyleSheet.create({
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successTitle: { ...TYPE.headline, color: COLORS.textPrimary },
  successText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  successBtn: { marginTop: 12 },
})
