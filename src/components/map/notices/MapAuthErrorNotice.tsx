import { memo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'

/**
 * [네이버 지도 인증 실패 안내] 인증에 실패해도 지도는 빈 화면으로만 남아, 알리지 않으면 앱이 멈춘 줄 안다.
 * 노란 경고 줄, X 로 닫는다.
 */
function MapAuthErrorNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View style={styles.notice}>
      <Ionicons name="warning" size={15} color={COLORS.warningIcon} />
      <Text style={styles.text}>지도를 불러오지 못했어요. 네이버 지도 인증에 실패했어요.</Text>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel="닫기"
      >
        <Ionicons name="close" size={15} color={COLORS.warningIcon} />
      </TouchableOpacity>
    </View>
  )
}

export default memo(MapAuthErrorNotice)

const styles = StyleSheet.create({
  notice: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: RADIUS.floating,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: COLORS.warning,
  },
})
