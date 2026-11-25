import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import { useNearbyRadiusMap } from '../../hooks/settings/useNearbyRadiusMap'
import { IMAGE_ASPECT } from '../../utils/settings/nearbyRadiusMap'

/**
 * 배경 그림(네이버 지도를 11-02 한 번 찍은 것). 설정을 열 때마다 지도를 불러오지 않는다.
 * 그림은 CSS 500×350 화면을 2배로 찍었고 가운데가 `CENTER` 다. 반경 30m 까지는 한 단계 더 확대한 그림을 쓴다.
 */
const BACKGROUNDS = {
  18: require('../../../assets/nearby/radius-z18.jpg'),
  17: require('../../../assets/nearby/radius-z17.jpg'),
} as const

/**
 * 알림 반경 아래 지도 예시(11-01, 11-02 그림으로 바꿈). 알림은 가게마다 따로 정한 영역(가게 둘레 반경) 안에 들어가 머물 때 온다.
 * 그래서 그림에 보이는 제휴 가게마다 고른 반경 원을 실제 축척으로 그린다. 원은 앱이 가진 업체 목록에서 그린다.
 */
export default function NearbyRadiusMap({ meters }: { meters: number }) {
  const { width, setWidth, zoom, height, zones } = useNearbyRadiusMap({ meters })

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
})
