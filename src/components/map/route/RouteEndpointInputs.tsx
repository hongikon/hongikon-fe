import { memo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import RouteDot from './RouteDot'

export type RouteEndpoint = 'from' | 'to'

interface Props {
  /** 지금 고르는 쪽(검색 목록이 이쪽을 채운다). */
  target: RouteEndpoint | null
  /** 정한 출발·도착 이름. null 이면 입력 안내 문구. */
  fromLabel: string | null
  toLabel: string | null
  onChangeTarget: (target: RouteEndpoint) => void
}

/** 길찾기 창 위쪽의 출발·도착 두 칸. 누르면 그쪽을 고르는 검색으로 바뀐다. */
function RouteEndpointInputs({ target, fromLabel, toLabel, onChangeTarget }: Props) {
  return (
    <View style={styles.box}>
      <EndpointRow kind="from" active={target === 'from'} label={fromLabel} placeholder="출발지 입력" onPress={onChangeTarget} />
      <View style={styles.divider} />
      <EndpointRow kind="to" active={target === 'to'} label={toLabel} placeholder="도착지 입력" onPress={onChangeTarget} />
    </View>
  )
}

function EndpointRow({
  kind,
  active,
  label,
  placeholder,
  onPress,
}: {
  kind: RouteEndpoint
  active: boolean
  label: string | null
  placeholder: string
  onPress: (kind: RouteEndpoint) => void
}) {
  return (
    <TouchableOpacity style={[styles.row, active && styles.rowActive]} onPress={() => onPress(kind)}>
      <RouteDot kind={kind} />
      <Text style={label ? styles.filled : styles.placeholder}>{label ?? placeholder}</Text>
    </TouchableOpacity>
  )
}

export default memo(RouteEndpointInputs)

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.fill,
    borderRadius: RADIUS.floating,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  rowActive: { backgroundColor: COLORS.primarySoft },
  placeholder: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPlaceholder },
  filled: { fontSize: 14, color: COLORS.textPrimary, fontFamily: FONTS.medium },
  divider: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginHorizontal: 14,
  },
})
