import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import NaverMapView, { type NaverMapViewHandle } from '../map/NaverMapView'
import { CAMPUS_CENTER, PARTNER_FOCUS_RADIUS_METERS } from '../../constants/map'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import { haversineMeters } from '../../utils/geo'
import { toMarker } from '../../utils/partnerMarker'
import { useMapData } from '../../lib/mapData'
import type { Partner } from '../../types'

/** 실제 판정은 GPS 오차를 반경에 더해 준다(rules.preciselyInside, 최대 15m). 점선 원으로 그만큼 바깥을 그린다. */
const GPS_ALLOWANCE_METERS = 15
/** 제휴업체가 가장 많이 모인 곳을 고를 때 세는 거리. */
const CLUSTER_METERS = 50

/**
 * 캠퍼스 근처 제휴업체 중 주변(50m, 같으면 100m)에 다른 제휴업체가 가장 많은 곳. 반경 예시 지도의 가운데로 쓴다.
 * 업체 데이터가 바뀌면 저절로 따라간다.
 */
function busiestPartner(partners: readonly Partner[]): Partner | null {
  const near = partners.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      haversineMeters(p.lat, p.lng, CAMPUS_CENTER.lat, CAMPUS_CENTER.lng) <= PARTNER_FOCUS_RADIUS_METERS,
  )
  let best: Partner | null = null
  let bestScore = -1
  for (const p of near) {
    let close = 0
    let wide = 0
    for (const q of near) {
      if (q === p) continue
      const d = haversineMeters(p.lat, p.lng, q.lat, q.lng)
      if (d <= CLUSTER_METERS) close++
      if (d <= CLUSTER_METERS * 2) wide++
    }
    const score = close * 1000 + wide
    if (score > bestScore) {
      best = p
      bestScore = score
    }
  }
  return best
}

/**
 * 원래 지도 페이지(map.html)에 그대로 넣는 스크립트 — 페이지를 새로 배포하지 않아도 된다(nearbyOverlayScript 와 같은 방식).
 * 반경·바깥 점선 원을 실제 미터로 그리고, 바깥 원이 화면에 들어오는 가장 큰 배율로 가운데를 맞춘다. 손으로 움직이지 못하게 막는다.
 */
function radiusScript(center: { lat: number; lng: number }, meters: number): string {
  const data = JSON.stringify({ lat: center.lat, lng: center.lng, meters, outer: meters + GPS_ALLOWANCE_METERS })
  return `(function () {
  if (!window.map || !window.naver) return;
  (window.__radiusPreview || []).forEach(function (o) { o.setMap(null); });
  window.__radiusPreview = [];
  var d = ${data};
  var c = new naver.maps.LatLng(d.lat, d.lng);
  map.setOptions({ draggable: false, pinchZoom: false, scrollWheel: false, keyboardShortcuts: false,
    disableDoubleTapZoom: true, disableDoubleClickZoom: true, disableTwoFingerTapZoom: true });
  function circle(radius, opt) {
    window.__radiusPreview.push(new naver.maps.Circle(Object.assign({ map: map, center: c, radius: radius, clickable: false }, opt)));
  }
  circle(d.outer, { strokeColor: '#05014A', strokeWeight: 1.5, strokeStyle: 'shortdash', strokeOpacity: 0.7, fillOpacity: 0 });
  circle(d.meters, { strokeColor: '#05014A', strokeWeight: 2.5, strokeOpacity: 1, fillColor: '#05014A', fillOpacity: 0.14 });
  var size = map.getSize();
  var fit = Math.min(size.width, size.height) * 0.42;
  var z = 20;
  for (; z > 14; z--) {
    var mpp = 156543.03392 * Math.cos(d.lat * Math.PI / 180) / Math.pow(2, z);
    if (d.outer / mpp <= fit) break;
  }
  map.setZoom(z, false);
  map.setCenter(c);
})(); true;`
}

function post(view: NaverMapViewHandle | null, msg: object) {
  view?.injectJavaScript(
    `if (typeof window.handleNativeMessage === "function") window.handleNativeMessage(${JSON.stringify(JSON.stringify(msg))});true;`,
  )
}

/**
 * 알림 반경 아래 실제 지도 예시(11-01). 캠퍼스 근처에서 제휴업체가 가장 많이 모인 업체를 가운데 두고,
 * 고른 반경(실선)과 GPS 오차를 더한 가장 바깥(점선)을 그린다. 보기 전용이라 손으로 움직이지 않는다.
 */
export default function NearbyRadiusMap({ meters }: { meters: number }) {
  const { partners } = useMapData()
  const mapRef = useRef<NaverMapViewHandle>(null)
  const [ready, setReady] = useState(false)
  const center = useMemo(() => busiestPartner(partners), [partners])
  const inside = useMemo(() => {
    if (!center) return 0
    return partners.filter((p) => haversineMeters(p.lat, p.lng, center.lat, center.lng) <= meters).length
  }, [partners, center, meters])

  const draw = useCallback(() => {
    if (!center) return
    const view = mapRef.current
    post(view, { type: 'setPartners', partners: partners.map(toMarker), bounds: null })
    post(view, { type: 'selectPartner', id: center.id })
    view?.injectJavaScript(radiusScript(center, meters))
  }, [center, partners, meters])

  useEffect(() => {
    if (ready) draw()
  }, [ready, draw])

  if (!center) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.map} pointerEvents="none">
        <NaverMapView ref={mapRef} html="" onMessage={() => {}} onReady={() => setReady(true)} />
        {!ready && (
          <View style={styles.loading}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        )}
      </View>
      <Text style={styles.caption}>
        {center.name} 기준 · 반경 {meters}m 안 제휴업체 {inside}곳
      </Text>
      <Text style={styles.legend}>
        제휴업체가 가장 많이 모인 곳을 예로 들었어요. 실선 원 안에 머물면 그 가게 알림이 오고, 점선은 GPS 오차를 더해 줄 수 있는 가장
        바깥(반경 + {GPS_ALLOWANCE_METERS}m)이에요.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  map: { height: 240, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.fill },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.fill },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  legend: { fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textTertiary },
})
