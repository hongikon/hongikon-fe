import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { formatDateTime } from '../../format'
import type { AdminUser } from '../../types'

/** 정지·위반 삭제 이력이 있던 계정으로 다시 가입한 회원의 이전 이력. 판단은 관리자가 한다(자동 정지 없음). */
export function PriorHistoryNote({ history }: { history: NonNullable<AdminUser['priorHistory']> }) {
  return (
    <View style={styles.prior}>
      <Text style={styles.priorTitle}>재가입 회원 · 이전 이용 제한 이력</Text>
      <Text style={styles.priorText}>
        {formatDateTime(history.withdrawnAt)} 탈퇴
        {history.wasSuspendedAtWithdrawal ? ' (탈퇴 당시 정지 중)' : ''}
      </Text>
      {history.suspendedAt ? (
        <Text style={styles.priorText}>
          {formatDateTime(history.suspendedAt)} 정지 · 사유: {history.suspendedReason ?? '(없음)'}
        </Text>
      ) : null}
      {history.violationReportCount > 0 ? <Text style={styles.priorText}>위반으로 삭제된 제보 {history.violationReportCount}건</Text> : null}
      <Text style={styles.priorNote}>기록 보관 기한 {formatDateTime(history.retainUntil)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  prior: { gap: 2, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.warningSoft },
  priorTitle: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.warning },
  priorText: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.warning },
  priorNote: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textTertiary, marginTop: 2 },
})
