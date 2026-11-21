import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { FLAG_REASON_LABEL, formatDateTime, formatMemberRef } from '../../format'
import { useReportFlags } from '../../hooks/useReportFlags'
import { Badge, InlineError } from '../../ui'

interface Props {
  reportId: number
  flagCount: number
}

/** 제보 카드의 '신고 N건' 접기·펼치기. 펼치면 사유·신고자(표시 이름 + 회원 번호)·시각을 보여 준다. */
export function ReportFlags({ reportId, flagCount }: Props) {
  const { flagsOpen, flags, flagsLoading, flagsError, loadFlags, toggleFlags } = useReportFlags(reportId)

  return (
    <View>
      <Pressable onPress={toggleFlags} accessibilityRole="button" hitSlop={12} style={styles.flagToggle}>
        <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
        <Text style={styles.flagToggleText}>신고 {flagCount}건</Text>
        <Ionicons name={flagsOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.danger} />
      </Pressable>
      {flagsOpen ? (
        <View style={styles.flags}>
          {flagsLoading ? <Text style={styles.meta}>불러오는 중…</Text> : null}
          {flagsError ? <InlineError message={flagsError} onRetry={loadFlags} /> : null}
          {flags?.map((flag) => (
            <View key={flag.id} style={styles.flagRow}>
              <Badge label={FLAG_REASON_LABEL[flag.reason] ?? flag.reason} tone="danger" />
              <Text style={styles.meta}>
                {/* 신고자는 표시 이름 + 회원 번호만. reporterNickname(예전 서버는 로그인 닉네임 원문)은 쓰지 않는다. */}
                {formatMemberRef(flag.reporterDisplayName, flag.reporterMemberCode, flag.reporterId, '신고자')} ·{' '}
                {formatDateTime(flag.createdAt)}
              </Text>
            </View>
          ))}
          {flags && flags.length === 0 ? <Text style={styles.meta}>신고 내역이 없습니다.</Text> : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  flagToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 2 },
  flagToggleText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.danger },
  flags: { gap: 6, marginTop: 6, paddingLeft: 20 },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
})
