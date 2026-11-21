import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { COLORS } from '../../../constants/colors'

/** 길찾기 출발(속이 빈 점)·도착(꽉 찬 점) 표시. 길찾기 창 입력 칸과 지도 위 출발·도착 막대가 같이 쓴다. */
function RouteDot({ kind }: { kind: 'from' | 'to' }) {
  return <View style={kind === 'from' ? styles.from : styles.to} />
}

export default memo(RouteDot)

const styles = StyleSheet.create({
  from: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: COLORS.primary, backgroundColor: COLORS.white },
  to: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
})
