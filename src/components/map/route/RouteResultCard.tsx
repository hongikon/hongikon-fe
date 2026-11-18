import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import type { RouteAlternative } from '../../../apis/routes'
import RouteOptions from '../RouteOptions'

interface Props {
  routes: RouteAlternative[]
  selectedIndex: number
  onSelect: (index: number) => void
  onClose: () => void
  bottom: number
  side: number
  /** 그려진 높이. 경로를 화면에 맞출 때 카드에 가리지 않게 쓴다. */
  onHeight: (height: number) => void
}

/** 길찾기 결과 카드(지도 아래). 후보 길을 고른다. 내 위치 출발에서 아직 위치를 못 받았으면 기다리는 안내. */
function RouteResultCard({ routes, selectedIndex, onSelect, onClose, bottom, side, onHeight }: Props) {
  return (
    <View
      style={[styles.wrap, { bottom, left: 12 + side, right: 12 + side }]}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
    >
      {routes[selectedIndex] ? (
        <RouteOptions routes={routes} selectedIndex={selectedIndex} onSelect={onSelect} onClose={onClose} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.note}>내 위치를 찾고 있어요</Text>
        </View>
      )}
    </View>
  )
}

export default memo(RouteResultCard)

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  note: { fontSize: 13, color: COLORS.textSecondary, fontFamily: FONTS.regular },
})
