import { useMemo } from 'react'
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FACILITY_KINDS } from '../../constants/facilityKinds'
import { facilityCount } from '../../utils/facilities'
import { chipStyles } from './chipStyles'
import type { FacilityKind, MapLayer } from '../../types'

const LAYERS: readonly { key: MapLayer; label: string; icon: 'business' | 'pricetags' }[] = [
  { key: '편의시설', label: '편의 시설', icon: 'business' },
  { key: '제휴업체', label: '제휴 업체', icon: 'pricetags' },
]

interface MapFilterChipsProps {
  /** 최상단 갈래. 고르지 않았으면 null 이고, 아래 칩 줄은 나오지 않는다. */
  layer: MapLayer | null
  /** 편의시설 종류. 레이어가 '편의시설' 일 때만 쓰인다. */
  facilityKind: FacilityKind | null
  /** 같은 칩을 다시 눌렀을 때의 해제 처리는 호출하는 쪽이 맡는다. */
  onSelectLayer: (value: MapLayer) => void
  onSelectFacilityKind: (value: FacilityKind) => void
}

/**
 * 검색바 아래 최상단 필터 줄.
 *
 * 먼저 무엇을 볼지(편의 시설 / 제휴 업체) 고르고, 그 다음에 그 갈래의 하위
 * 칩이 나온다. 둘을 같이 띄우면 지도에 성격이 다른 마커가 섞여 무엇을 보고
 * 있는지 알 수 없다.
 *
 * '제휴 업체' 를 골랐을 때의 하위 두 줄(소속·업종)은 `PartnerChips` 가 맡는다.
 * 여기서는 최상단 줄과 편의시설 종류 줄만 그린다.
 */
export default function MapFilterChips({
  layer,
  facilityKind,
  onSelectLayer,
  onSelectFacilityKind,
}: MapFilterChipsProps) {
  const facilityCounts = useMemo(
    () => FACILITY_KINDS.map((meta) => ({ meta, count: facilityCount(meta.key) })),
    [],
  )

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={chipStyles.scroll}
        contentContainerStyle={chipStyles.row}
      >
        {LAYERS.map(({ key, label, icon }) => {
          const isActive = layer === key
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.75}
              onPress={() => onSelectLayer(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={label}
              style={[chipStyles.chip, styles.layerChip, isActive && styles.layerChipActive]}
            >
              <Ionicons
                name={icon}
                size={13}
                color={isActive ? COLORS.white : COLORS.primary}
              />
              <Text style={[chipStyles.label, isActive && chipStyles.labelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {layer === '편의시설' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={chipStyles.scroll}
          contentContainerStyle={chipStyles.row}
        >
          {facilityCounts.map(({ meta, count }) => {
            const isActive = facilityKind === meta.key
            return (
              <TouchableOpacity
                key={meta.key}
                activeOpacity={0.75}
                onPress={() => onSelectFacilityKind(meta.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${meta.key} ${count}곳`}
                style={[
                  chipStyles.chip,
                  chipStyles.chipTransparent,
                  count === 0 && chipStyles.chipEmpty,
                  isActive && { backgroundColor: meta.color, borderColor: meta.color },
                ]}
              >
                <Ionicons
                  name={meta.icon}
                  size={13}
                  color={isActive ? COLORS.white : meta.color}
                />
                <Text style={[chipStyles.label, isActive && chipStyles.labelActive]}>
                  {meta.key}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  // 최상단 줄은 아래 줄들보다 한 단계 위라는 것이 보여야 해, 테두리를 진하게 둔다.
  layerChip: { borderColor: COLORS.primary },
  layerChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
})
