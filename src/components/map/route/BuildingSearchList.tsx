import { memo, useCallback, type ComponentProps } from 'react'
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import type { Building } from '../../../types'
import type { RouteEndpoint } from './RouteEndpointInputs'
import { useBuildingSearchList } from '../../../hooks/map/route/useBuildingSearchList'
import { keyOf } from '../../../utils/map/route/buildingSearchList'

export interface Props {
  target: RouteEndpoint
  query: string
  onChangeQuery: (query: string) => void
  buildings: readonly Building[]
  onSelectBuilding: (building: Building) => void
  /** 도착을 고를 때 맨 위 '지도에서 핀으로 고르기'. */
  onPickDestinationOnMap: () => void
  /** 출발을 고를 때 맨 위 '내 위치'. 위치를 못 쓰는 기기면 넘기지 않는다(줄을 숨긴다). */
  onSelectMyLocation?: () => void
}

/** 길찾기 창의 건물 검색 칸과 결과 목록. */
function BuildingSearchList({ target, query, onChangeQuery, buildings, onSelectBuilding, onPickDestinationOnMap, onSelectMyLocation }: Props) {
  const { filtered } = useBuildingSearchList({ query, buildings })

  const renderItem = useCallback(
    ({ item }: { item: Building }) => (
      <ListRow
        dot
        title={item.name}
        subtitle={item.type && item.type !== '확인 필요' ? item.type : undefined}
        onPress={() => onSelectBuilding(item)}
      />
    ),
    [onSelectBuilding],
  )

  const header =
    target === 'to' ? (
      <ListRow
        icon="flag"
        title="지도에서 핀으로 고르기"
        subtitle="지도를 움직여 도착할 건물에 핀을 맞춰요"
        onPress={onPickDestinationOnMap}
        accessibilityLabel="지도에서 핀으로 도착 건물 고르기"
      />
    ) : onSelectMyLocation ? (
      <ListRow
        icon="navigate"
        title="내 위치"
        subtitle="위치는 휴대폰 안에서만 써요"
        onPress={onSelectMyLocation}
        accessibilityLabel="내 위치에서 출발"
      />
    ) : null

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="건물 검색"
          placeholderTextColor={COLORS.textPlaceholder}
          value={query}
          onChangeText={onChangeQuery}
          autoFocus
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
      />
    </View>
  )
}

/** 목록 한 줄: 왼쪽 점(건물) 또는 아이콘, 이름, 작은 설명, 오른쪽 화살표. */
function ListRow({
  dot,
  icon,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
}: {
  dot?: boolean
  icon?: ComponentProps<typeof Ionicons>['name']
  title: string
  subtitle?: string
  onPress: () => void
  accessibilityLabel?: string
}) {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      accessibilityRole={accessibilityLabel ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {/* 건물별 색 대신 앱 메인 컬러로 통일. */}
      {dot ? <View style={styles.itemDot} /> : icon ? <Ionicons name={icon} size={18} color={COLORS.primary} /> : null}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{title}</Text>
        {subtitle ? <Text style={styles.itemType}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.chevron} />
    </TouchableOpacity>
  )
}

export default memo(BuildingSearchList)

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 12 },
  searchBar: {
    marginHorizontal: 16,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.fill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: { fontFamily: FONTS.regular, flex: 1, minWidth: 0, fontSize: 14, color: COLORS.textPrimary },
  list: { paddingHorizontal: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  itemDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
  },
  itemType: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
})
