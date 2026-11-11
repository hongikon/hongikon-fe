import { useMemo, useState } from 'react'
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import { useMapData } from '../../lib/mapData'
import { ACCURACY_ALLOWANCE_METERS } from '../../lib/nearbyPartners/rules'

/** 실제 판정은 GPS 오차를 반경에 더해 준다(rules.preciselyInside). 설명 글에만 적는다. */
const GPS_ALLOWANCE_METERS = ACCURACY_ALLOWANCE_METERS

/**
 * 예시 그림의 가운데 지점(11-02 운영진이 고름, 소코아 홍대점 위치). 상수역 앞 제휴업체가 모인 골목이다. 알림 영역은 가게마다 그린다.
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

/** 웹 메르카토르에서 확대 단계 zoom 의 화면 좌표(CSS px). 그림 가운데(`CENTER`)와의 차이로 업체 위치를 그림 위에 찍는다. */
function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const world = 256 * 2 ** zoom
  const sin = Math.sin((lat * Math.PI) / 180)
  return { x: ((lng + 180) / 360) * world, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world }
}

/**
 * 알림 반경 아래 지도 예시(11-01, 11-02 그림으로 바꿈). 알림은 가게마다 따로 정한 영역(가게 둘레 반경) 안에 들어가 머물 때 온다.
 * 그래서 그림에 보이는 제휴 가게마다 고른 반경 원을 실제 축척으로 그린다. 원은 앱이 가진 업체 목록에서 그린다.
 */
export default function NearbyRadiusMap({ meters }: { meters: number }) {
  const { partners } = useMapData()
  const [width, setWidth] = useState(0)
  const zoom = meters <= 30 ? 18 : 17
  const height = width / IMAGE_ASPECT

  // 그림 안에 들어오는 가게와 그 위치(px). 반경이 그림 밖으로 걸치는 가게도 원 일부가 보이게 넣는다.
  const zones = useMemo(() => {
    if (width <= 0) return []
    const scale = width / IMAGE_CSS_WIDTH
    const center = project(CENTER.lat, CENTER.lng, zoom)
    const r = (meters / metersPerPixel(zoom)) * scale
    return partners
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => {
        const at = project(p.lat, p.lng, zoom)
        return { id: p.id, x: width / 2 + (at.x - center.x) * scale, y: height / 2 + (at.y - center.y) * scale, r }
      })
      .filter((z) => z.x > -z.r && z.x < width + z.r && z.y > -z.r && z.y < height + z.r)
  }, [partners, meters, zoom, width, height])

  return (
    <View style={styles.wrap}>
      <View
        style={styles.map}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel={`제휴 가게마다 반경 ${meters}미터 알림 영역 예시 지도`}
      >
        {/* absoluteFill 만 주면 iOS 에서 그림이 원래 픽셀 크기(1000×700)로 왼쪽 위에 그려졌다(11-02 테스트 앱). 크기를 숫자로 준다. */}
        {width > 0 && (
          <Image source={BACKGROUNDS[zoom]} style={{ position: 'absolute', left: 0, top: 0, width, height }} resizeMode="stretch" />
        )}
        {zones.map((z) => (
          <View
            key={z.id}
            style={[
              styles.zone,
              meters > 30 && styles.zoneWide,
              { width: z.r * 2, height: z.r * 2, borderRadius: z.r, left: z.x - z.r, top: z.y - z.r },
            ]}
          />
        ))}
      </View>
      <Text style={styles.caption}>
        가게마다 반경 {meters}m · 이 지도에 {zones.length}곳
      </Text>
      <Text style={styles.legend}>
        원 하나가 제휴 가게 하나의 알림 영역이에요. 이 영역 안에 들어가 잠시 머물면 그 가게 알림이 와요. GPS 오차를 생각해 최대{' '}
        {GPS_ALLOWANCE_METERS}m까지 넉넉하게 봐줘요.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  map: { aspectRatio: IMAGE_ASPECT, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.fill },
  zone: { position: 'absolute', borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: 'rgba(5, 1, 74, 0.12)' },
  // 반경이 크면 원이 많이 겹쳐 지도가 덮이므로 옅게.
  zoneWide: { borderWidth: 1, borderColor: 'rgba(5, 1, 74, 0.45)', backgroundColor: 'rgba(5, 1, 74, 0.04)' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  legend: { fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textTertiary },
})
