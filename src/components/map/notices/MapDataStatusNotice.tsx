import { memo } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { noticeStyles } from './noticeStyles'

/**
 * [지도 정보 불러오기 안내] 건물·편의시설·제휴 지도 데이터가 아직 하나도 없을 때만 띄운다
 * (저장본이 있으면 그걸로 그리고 조용히 새로 받는다). 받는 중이면 돌아가는 표시, 실패면 '다시 시도'.
 */
function MapDataStatusNotice({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return (
    <View style={noticeStyles.pill} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {failed ? (
        <>
          <Ionicons name="cloud-offline-outline" size={14} color={COLORS.primary} />
          <Text style={[noticeStyles.text, styles.text]}>지도 정보를 불러오지 못했어요</Text>
          <TouchableOpacity
            onPress={onRetry}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="지도 정보 다시 불러오기"
          >
            <Text style={noticeStyles.action}>다시 시도</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={[noticeStyles.text, styles.text]}>지도 정보를 불러오는 중이에요</Text>
        </>
      )}
    </View>
  )
}

export default memo(MapDataStatusNotice)

const styles = StyleSheet.create({
  text: { flex: 1, color: COLORS.primary },
})
