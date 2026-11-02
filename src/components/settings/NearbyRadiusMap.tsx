import { useMemo, useState } from 'react'
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import { haversineMeters } from '../../utils/geo'
import { useMapData } from '../../lib/mapData'

/** 실제 판정은 GPS 오차를 반경에 더해 준다(rules.preciselyInside, 최대 15m). 점선 원으로 그만큼 바깥을 그린다. */
const GPS_ALLOWANCE_METERS = 15

/**
 * 예시 지도 가운데 업체(11-02 운영진이 고름). 상수역 앞 제휴업체가 모인 골목이다.
 * 배경 그림이 이 업체를 정가운데에 두고 찍은 것이라, 업체를 바꾸면 그림도 다시 찍어야 한다.
 */
const CENTER = { name: '소코아 홍대점', lat: 37.548639, lng: 126.920953 } as const

/**
 * 배경 그림(네이버 지도를 11-02 한 번 찍은 것). 설정을 열 때마다 지도를 불러오지 않는다.
 * 그림은 CSS 500×350 화면을 2배로 찍었고 가운데가 `CENTER` 다. 반경 30m 까지는 한 단계 더 확대한 그림을 쓴다.
 */
const BACKGROUNDS = {
  18: require('../../../assets/nearby/radius-z18.jpg'),
  17: require('../../../assets/nearby/radius-z17.jpg'),
} as const
const IMAGE_CSS_WIDTH = 500
const IMAGE_ASPECT = 500 / 350

/** 네이버 지도(웹 메르카토르)에서 확대 단계 zoom 의 CSS 1px 당 미터. */
function metersPerPixel(zoom: number): number {
  return (156543.03392 * Math.cos((CENTER.lat * Math.PI) / 180)) / 2 ** zoom
}

/**
 * 알림 반경 아래 지도 예시(11-01, 11-02 그림으로 바꿈). 예시 업체를 가운데 두고,
 * 고른 반경(실선)과 GPS 오차를 더한 가장 바깥(점선)을 그림 위에 실제 축척으로 그린다.
 */
export default function NearbyRadiusMap({ meters }: { meters: number }) {
  const { partners } = useMapData()
  const [width, setWidth] = useState(0)
  const zoom = meters <= 30 ? 18 : 17
  const inside = useMemo(
    () => partners.filter((p) => haversineMeters(p.lat, p.lng, CENTER.lat, CENTER.lng) <= meters).length,
    [partners, meters],
  )

  const pxPerMeter = width > 0 ? width / IMAGE_CSS_WIDTH / metersPerPixel(zoom) : 0
  const circle = (radiusMeters: number) => {
    const r = radiusMeters * pxPerMeter
    return { width: r * 2, height: r * 2, borderRadius: r, left: width / 2 - r, top: width / IMAGE_ASPECT / 2 - r }
  }

  return (
    <View style={styles.wrap}>
      <View
        style={styles.map}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel={`${CENTER.name} 기준 반경 ${meters}미터 예시 지도`}
      >
        <Image source={BACKGROUNDS[zoom]} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {width > 0 && (
          <>
            <View style={[styles.outer, circle(meters + GPS_ALLOWANCE_METERS)]} />
            <View style={[styles.inner, circle(meters)]} />
          </>
        )}
      </View>
      <Text style={styles.caption}>
        {CENTER.name} 기준 · 반경 {meters}m 안 제휴업체 {inside}곳
      </Text>
      <Text style={styles.legend}>
        제휴업체가 모인 상수역 앞 골목의 한 가게를 예로 들었어요. 실선 원 안에 머물면 그 가게 알림이 오고, 점선은 GPS 오차를 더해 줄 수 있는 가장
        바깥(반경 + {GPS_ALLOWANCE_METERS}m)이에요.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  map: { aspectRatio: IMAGE_ASPECT, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.fill },
  inner: { position: 'absolute', borderWidth: 2.5, borderColor: COLORS.primary, backgroundColor: 'rgba(5, 1, 74, 0.14)' },
  outer: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(5, 1, 74, 0.7)', borderStyle: 'dashed' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  legend: { fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textTertiary },
})
