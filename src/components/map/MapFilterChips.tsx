import { useMemo } from 'react'
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FACILITY_KINDS, facilityKindMeta } from '../../constants/facilityKinds'
import { facilityCount } from '../../utils/facilities'
import { chipStyles } from './chipStyles'
import ChipIcon from './ChipIcon'
import type { FacilityKind, MapLayer } from '../../types'

const LAYERS: readonly {
  key: MapLayer
  label: string
  icon: 'business' | 'pricetags' | 'calendar'
}[] = [
  { key: '편의시설', label: '편의 시설', icon: 'business' },
  { key: '제휴업체', label: '제휴 업체', icon: 'pricetags' },
  { key: '이벤트', label: '이벤트', icon: 'calendar' },
]

// '행사·전시'는 '이벤트' 하위 칩으로만 보여준다. 편의시설 줄에도 두면 같은
// 데이터가 두 곳에 뜨는 것처럼 보인다.
const VISIBLE_FACILITY_KINDS = FACILITY_KINDS.filter((meta) => meta.key !== '행사·전시')
const EXHIBIT_META = facilityKindMeta('행사·전시')

interface MapFilterChipsProps {
  /** 최상단 갈래. 고르지 않았으면 null 이고, 아래 칩 줄은 나오지 않는다. */
  layer: MapLayer | null
  /** 편의시설 종류. 레이어가 '편의시설' 이거나 '이벤트'(전시)일 때 쓰인다. */
  facilityKind: FacilityKind | null
  /** 제보 레이어 on/off. 레이어가 '이벤트' 일 때 '제보' 칩의 선택 상태로 쓰인다. */
  reportsOn: boolean
  /** 같은 칩을 다시 눌렀을 때의 해제 처리는 호출하는 쪽이 맡는다. */
  onSelectLayer: (value: MapLayer) => void
  onSelectFacilityKind: (value: FacilityKind) => void
  onToggleReports: () => void
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
  reportsOn,
  onSelectLayer,
  onSelectFacilityKind,
  onToggleReports,
}: MapFilterChipsProps) {
  const facilityCounts = useMemo(
    () => VISIBLE_FACILITY_KINDS.map((meta) => ({ meta, count: facilityCount(meta.key) })),
    [],
  )

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[chipStyles.scroll, styles.layerRow]}
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
              <ChipIcon name={icon} color={COLORS.primary} active={isActive} />
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
                  count === 0 && chipStyles.chipEmpty,
                  isActive && { backgroundColor: meta.color, borderColor: meta.color },
                ]}
              >
                <ChipIcon name={meta.icon} color={meta.color} active={isActive} />
                <Text style={[chipStyles.label, isActive && chipStyles.labelActive]}>
                  {meta.key}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {layer === '이벤트' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={chipStyles.scroll}
          contentContainerStyle={chipStyles.row}
        >
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => onSelectFacilityKind('행사·전시')}
            accessibilityRole="button"
            accessibilityState={{ selected: facilityKind === '행사·전시' }}
            accessibilityLabel="전시"
            style={[
              chipStyles.chip,
              facilityKind === '행사·전시' && {
                backgroundColor: EXHIBIT_META.color,
                borderColor: EXHIBIT_META.color,
              },
            ]}
          >
            <ChipIcon
              name={EXHIBIT_META.icon}
              color={EXHIBIT_META.color}
              active={facilityKind === '행사·전시'}
            />
            <Text style={[chipStyles.label, facilityKind === '행사·전시' && chipStyles.labelActive]}>
              전시
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onToggleReports}
            accessibilityRole="button"
            accessibilityState={{ selected: reportsOn }}
            accessibilityLabel={reportsOn ? '제보 숨기기' : '제보 보기'}
            style={[
              chipStyles.chip,
              reportsOn && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
            ]}
          >
            <ChipIcon name="megaphone" color={COLORS.primary} active={reportsOn} />
            <Text style={[chipStyles.label, reportsOn && chipStyles.labelActive]}>제보</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  // 검색바 바로 아래 최상단 줄. 제목·검색바와 이어지는 흰 배경을 유지해,
  // 그 아래 칩 줄들(투명, 지도가 비쳐 보임)과 달리 지도가 비치지 않게 한다.
  layerRow: { backgroundColor: COLORS.white, paddingVertical: 8 },
  // 최상단 줄은 아래 줄들보다 한 단계 위라는 것이 보여야 해, 테두리를 진하게 둔다.
  // 칩 배경은 흰 면 없이 아래 줄들처럼 투명하게 둔다 — 선택 시에만 색으로 채운다.
  layerChip: { borderColor: COLORS.primary, backgroundColor: 'transparent' },
  layerChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
})
