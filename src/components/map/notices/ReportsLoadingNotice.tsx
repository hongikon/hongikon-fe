import { memo } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { noticeStyles } from './noticeStyles'

/** [제보 불러오는 중 안내] 0.4초 넘게 걸릴 때만 띄운다(금방 오면 반짝이지 않게 — 부르는 쪽이 정한다). */
function ReportsLoadingNotice() {
  return (
    <View style={noticeStyles.pill}>
      <ActivityIndicator size="small" color={COLORS.textSecondary} />
      <Text style={noticeStyles.text}>제보를 불러오는 중…</Text>
    </View>
  )
}

export default memo(ReportsLoadingNotice)
