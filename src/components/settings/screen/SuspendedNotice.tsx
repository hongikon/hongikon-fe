import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { TYPE } from '../../../constants/typography'
import { RADIUS, SPACING } from '../../../constants/spacing'

/** 이용 제한(약관 제10조): 사유와 이의 제기 방법을 맨 위에 알린다. 서버가 정지 알림 푸시도 보낸다. */
export default function SuspendedNotice({ reason }: { reason: string | null | undefined }) {
  return (
    <View style={styles.suspendedBox} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
      <View style={styles.suspendedBody}>
        <Text style={styles.suspendedTitle}>이용이 제한된 계정이에요</Text>
        <Text style={styles.suspendedText}>
          {reason ? `사유: ${reason}\n` : ''}
          제보·신고·문의를 할 수 없어요. 이의가 있으면 제한 알림을 받은 날부터 14일 안에 hongikonsupport@gmail.com 으로 알려 주세요.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // 다른 묶음 카드와 같은 바깥 여백·곡률·안쪽 여백(10-08).
  suspendedBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  suspendedBody: { flex: 1, gap: 4 },
  suspendedTitle: { ...TYPE.subhead, color: COLORS.danger },
  suspendedText: { ...TYPE.caption, color: COLORS.danger },
})
