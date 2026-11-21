import { memo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { noticeStyles } from './noticeStyles'

interface Props {
  title: string
  summary: string
  onBack: () => void
  onClose: () => void
}

/**
 * [물어보기 장소 설명 카드] 물어보기 답의 '지도에서 보기'로 온 곳의 짧은 설명(11-07).
 * '물어보기로 돌아가기'로 대화로 돌아가고, X 나 그 곳 시트를 닫으면 사라진다.
 */
function AskPlaceCard({ title, summary, onBack, onClose }: Props) {
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.primary} style={styles.icon} />
      <View style={noticeStyles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {summary ? (
          <Text style={styles.summary} numberOfLines={3}>
            {summary}
          </Text>
        ) : null}
        <TouchableOpacity onPress={onBack} hitSlop={6} accessibilityRole="button" accessibilityLabel="물어보기로 돌아가기">
          <Text style={styles.back}>물어보기로 돌아가기</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="설명 닫기">
        <Ionicons name="close" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  )
}

export default memo(AskPlaceCard)

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    alignSelf: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  icon: { marginTop: 1 },
  title: { fontSize: 14, color: COLORS.textPrimary, fontFamily: FONTS.semibold },
  summary: { fontSize: 13, color: COLORS.textSecondary, fontFamily: FONTS.regular, marginTop: 2, lineHeight: 18 },
  back: { fontSize: 12, color: COLORS.primary, fontFamily: FONTS.semibold, marginTop: 6 },
})
