import { memo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'

interface Props {
  /** 넓은 창(웹·태블릿)에서 아래 시트와 같은 너비로 맞추는 양쪽 여백. 좁으면 0. */
  sideGutter: number
  onPress: () => void
}

/** 지도 맨 위 검색바. 누르면 제휴 업체·편의시설 검색 창이 열린다(여기서 직접 입력하지 않는다). */
function MapSearchBar({ sideGutter, onPress }: Props) {
  return (
    <View style={[styles.wrap, sideGutter > 0 && { paddingHorizontal: sideGutter }]}>
      <TouchableOpacity
        style={styles.bar}
        activeOpacity={0.7}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="제휴 업체·편의시설 검색"
      >
        <Ionicons name="search" size={18} color={COLORS.textTertiary} />
        <Text style={styles.placeholder}>제휴 업체·편의시설 검색</Text>
      </TouchableOpacity>
    </View>
  )
}

export default memo(MapSearchBar)

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  bar: {
    height: 44,
    borderRadius: RADIUS.floating,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  placeholder: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPlaceholder },
})
