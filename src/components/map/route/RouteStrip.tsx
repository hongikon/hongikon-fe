import { memo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import RouteDot from './RouteDot'
import type { RouteEndpoint } from './RouteEndpointInputs'

interface Props {
  /** 정한 출발·도착 이름. null 이면 '지도에서 건물을 눌러요' 안내. */
  fromLabel: string | null
  toLabel: string | null
  /** 출발·도착이 건물이면 누를 때 층을 바꾼다(아니면 검색 창으로 고른다). 읽어 주는 문구가 달라진다. */
  fromIsBuilding: boolean
  toIsBuilding: boolean
  /** 출발·도착 바꾸기 버튼(둘 다 건물일 때만). */
  canSwap: boolean
  onPressEndpoint: (endpoint: RouteEndpoint) => void
  onSearch: () => void
  onSwap: () => void
  onClose: () => void
  top: number
  side: number
  /** 그려진 높이. 경로를 화면에 맞출 때 막대에 가리지 않게 쓴다. */
  onHeight: (height: number) => void
}

/** 길찾기 중 지도 맨 위 출발·도착 막대(검색바 자리). 줄을 누르면 층 바꾸기 또는 그쪽 고르기, 오른쪽은 검색·바꾸기·끝내기. */
function RouteStrip({
  fromLabel,
  toLabel,
  fromIsBuilding,
  toIsBuilding,
  canSwap,
  onPressEndpoint,
  onSearch,
  onSwap,
  onClose,
  top,
  side,
  onHeight,
}: Props) {
  return (
    <View
      style={[styles.strip, { top, left: 12 + side, right: 12 + side }]}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
    >
      <View style={styles.rows}>
        <StripRow
          kind="from"
          label={fromLabel}
          placeholder="출발 — 지도에서 건물을 눌러요"
          a11y={fromIsBuilding ? `출발 ${fromLabel}, 층 바꾸기` : '출발지 고르기'}
          onPress={onPressEndpoint}
        />
        <View style={styles.divider} />
        <StripRow
          kind="to"
          label={toLabel}
          placeholder="도착 — 지도에서 건물을 눌러요"
          a11y={toIsBuilding ? `도착 ${toLabel}, 층 바꾸기` : '도착지 고르기'}
          onPress={onPressEndpoint}
        />
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onSearch} style={styles.icon} accessibilityRole="button" accessibilityLabel="건물 검색">
          <Ionicons name="search" size={18} color={COLORS.primary} />
        </TouchableOpacity>
        {canSwap ? (
          <TouchableOpacity onPress={onSwap} style={styles.icon} accessibilityRole="button" accessibilityLabel="출발 도착 바꾸기">
            <Ionicons name="swap-vertical" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={onClose}
          style={[styles.icon, styles.close]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="길찾기 끝내기"
        >
          <Ionicons name="close" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

function StripRow({
  kind,
  label,
  placeholder,
  a11y,
  onPress,
}: {
  kind: RouteEndpoint
  label: string | null
  placeholder: string
  a11y: string
  onPress: (kind: RouteEndpoint) => void
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(kind)} accessibilityRole="button" accessibilityLabel={a11y}>
      <RouteDot kind={kind} />
      <Text style={label ? styles.label : styles.placeholder} numberOfLines={1}>
        {label ?? placeholder}
      </Text>
    </TouchableOpacity>
  )
}

export default memo(RouteStrip)

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  rows: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 20 },
  label: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontFamily: FONTS.semibold },
  placeholder: { flex: 1, fontSize: 14, color: COLORS.textTertiary, fontFamily: FONTS.regular },
  actions: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  close: { backgroundColor: COLORS.primarySoft, marginLeft: 2 },
})
