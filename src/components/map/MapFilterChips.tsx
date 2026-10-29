import { useMemo } from 'react'
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FACILITY_KINDS } from '../../constants/facilityKinds'
import { facilityCount } from '../../utils/facilities'
import { useMapData } from '../../lib/mapData'
import { chipStyles, useChipRowScrollStyle } from './chipStyles'
import ChipIcon from './ChipIcon'
import type { FacilityKind, MapLayer } from '../../types'
import * as haptics from '../../lib/haptics'

const LAYERS: readonly {
  key: MapLayer
  label: string
  icon: 'business' | 'pricetags'
}[] = [
  { key: '제휴업체', label: '제휴 업체', icon: 'pricetags' },
  // '편의시설' 갈래. 전시(미술관·박물관)까지 들어와 '편의'보다 넓어 화면 이름은 '학교 시설'(10-27).
  { key: '편의시설', label: '학교 시설', icon: 'business' },
]

// '이벤트' 갈래는 없앴다(10-27). 전시는 학교 시설 종류 칩 하나가 되고, 제보 보기(켜기·종류·HOT)는
// 지도 오른쪽 아래 메뉴(MapActionMenu)로 옮겼다 — 위쪽 칩은 '어디에 뭐가 있나'만 맡는다.
// 엘리베이터는 위치가 건물 단위로만 확인돼 쓸모가 적어 칩에서 숨긴다(데이터는 남겨 둔다, 10-02 요청).
// 흡연구역은 10-05 에 숨겼다가 운영진이 11곳 좌표를 직접 찍어 정리한 뒤 다시 보인다(10-27).
const HIDDEN_FACILITY_KINDS = new Set(['엘리베이터'])
const VISIBLE_FACILITY_KINDS = FACILITY_KINDS.filter((meta) => !HIDDEN_FACILITY_KINDS.has(meta.key))
/** 칩에는 짧게. 서버 값 '행사·전시'의 행사는 이제 제보로 받는다. */
const CHIP_LABEL: Partial<Record<FacilityKind, string>> = { '행사·전시': '전시' }

interface MapFilterChipsProps {
  /** 최상단 갈래. 고르지 않았으면 null 이고, 아래 칩 줄은 나오지 않는다. */
  layer: MapLayer | null
  /** 편의시설 종류. 레이어가 '편의시설' 일 때 쓰인다. */
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
  const rowScroll = useChipRowScrollStyle()
  // 아직 데이터가 하나도 없는 종류(정수기·학생처 등)는 칩을 숨긴다. 눌러도 빈 지도와 "0곳"만 보였다.
  // 지도 데이터를 아직 못 받았으면 칩 대신 안내 한 줄만 둔다(지도 위 안내와 같은 상태).
  const { facilities, data } = useMapData()
  const facilityCounts = useMemo(
    () =>
      VISIBLE_FACILITY_KINDS.map((meta) => ({ meta, count: facilityCount(facilities, meta.key) })).filter(
        ({ count }) => count > 0,
      ),
    [facilities],
  )

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[rowScroll, styles.layerRow]}
        contentContainerStyle={chipStyles.row}
      >
        {LAYERS.map(({ key, label, icon }) => {
          const isActive = layer === key
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.75}
              onPress={() => {
                haptics.selection()
                onSelectLayer(key)
              }}
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
          style={rowScroll}
          contentContainerStyle={chipStyles.row}
        >
          {!data && (
            <View style={chipStyles.chip} accessibilityRole="text">
              <Text style={[chipStyles.label, styles.pendingText]}>편의시설 정보를 불러오는 중이에요</Text>
            </View>
          )}
          {facilityCounts.map(({ meta, count }) => {
            const isActive = facilityKind === meta.key
            return (
              <TouchableOpacity
                key={meta.key}
                activeOpacity={0.75}
                onPress={() => {
                  haptics.selection()
                  onSelectFacilityKind(meta.key)
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${CHIP_LABEL[meta.key] ?? meta.label ?? meta.key} ${count}곳`}
                style={[
                  chipStyles.chip,
                  isActive && { backgroundColor: meta.color, borderColor: meta.color },
                ]}
              >
                <ChipIcon name={meta.icon} color={meta.color} active={isActive} />
                <Text style={[chipStyles.label, isActive && chipStyles.labelActive]}>
                  {CHIP_LABEL[meta.key] ?? meta.label ?? meta.key}
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
  // 검색바 바로 아래 최상단 줄. 줄 자체는 다른 칩 줄처럼 투명하게 둬서 지도가
  // 비쳐 보이게 하고(chipStyles.chip 의 흰 알약만 뜬다), 세로 여백만 맞춘다.
  layerRow: { paddingVertical: 8 },
  // 최상단 줄은 아래 줄들보다 한 단계 위라는 것이 보여야 해, 테두리만 진하게 둔다.
  layerChip: { borderColor: COLORS.primary },
  layerChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pendingText: { color: COLORS.textSecondary },
})
