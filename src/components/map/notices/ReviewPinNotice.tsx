import { memo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { noticeStyles } from './noticeStyles'

/**
 * [관리자 검토 핀 안내] 관리 탭 '지도에서 보기'로 찍은 검토용 임시 핀이 있는 동안 남색 줄로 무엇을 보는지 알린다.
 * label 은 제보 제목, detail 은 작성자·건물·층. X 로 핀과 함께 닫는다.
 */
function ReviewPinNotice({ label, detail, onClose }: { label: string; detail: string; onClose: () => void }) {
  return (
    <View style={styles.notice}>
      <Ionicons name="eye-outline" size={14} color={COLORS.white} />
      <View style={noticeStyles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          검토 중인 제보 · {label}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="검토 위치 핀 닫기">
        <Ionicons name="close" size={18} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  )
}

export default memo(ReviewPinNotice)

const styles = StyleSheet.create({
  notice: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.floating,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  title: { fontSize: 13, color: COLORS.white, fontFamily: FONTS.semibold },
  detail: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: FONTS.regular, marginTop: 1 },
})
