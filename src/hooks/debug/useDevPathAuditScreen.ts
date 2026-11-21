import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { buildMapHTML } from '../../utils/map/mapHtml'
import { useMapData } from '../../lib/mapData'
import { PATH_EDGES, PATH_WAYPOINTS } from '../../constants/pathNodes'
import { auditPathNetwork, type AuditPoint } from '../../utils/pathSurvey/audit'
import { KIND_COLOR, type Kind } from '../../utils/debug/devPathAuditScreen'

/** DevPathAuditScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDevPathAuditScreen() {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const { buildings, data, status, reload } = useMapData()
  const mapHTML = useMemo(() => buildMapHTML(buildings, 'nodes'), [buildings])
  const audit = useMemo(() => auditPathNetwork(PATH_WAYPOINTS, PATH_EDGES, buildings), [buildings])
  const { width } = useWindowDimensions()
  const wide = width >= 900
  const [selected, setSelected] = useState<string | null>(null)

  // 내부 점검 화면이라 검색 결과에 나오지 않게 한다(웹).
  useEffect(() => {
    if (typeof document === 'undefined') return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    document.title = '경로망 점검 | 홍익온'
    return () => {
      meta.remove()
    }
  }, [])

  const overlayPoints = useMemo(() => {
    const out: { kind: Kind; point: AuditPoint }[] = []
    audit.isolatedWaypoints.forEach((point) => out.push({ kind: 'isolated', point }))
    audit.detachedGroups.forEach((group) => group.forEach((point) => out.push({ kind: 'detached', point })))
    audit.unconnectedEntrances.forEach((point) => out.push({ kind: 'entrance', point }))
    audit.unconnectedBuildings.forEach((point) => out.push({ kind: 'building', point }))
    return out
  }, [audit])

  // 지도 페이지 전역 `map` 위에 문제 지점을 덧그린다(지도 페이지 코드는 건드리지 않는다).
  const drawOverlay = useCallback(() => {
    // 이름표는 연결 안 된 지점·끊긴 덩어리에만 단다(출입구 100여 개에 다 달면 글자가 겹쳐 안 읽힌다). 나머지는 작은 점.
    const items = overlayPoints.map(({ kind, point }) => ({
      id: point.id,
      lat: point.lat,
      lng: point.lng,
      color: KIND_COLOR[kind],
      big: kind === 'isolated' || kind === 'detached',
    }))
    webViewRef.current?.injectJavaScript(`(function(){
      if (typeof map === 'undefined' || !window.naver) return;
      map.setOptions({ minZoom: 10, maxBounds: null });
      (window.__auditMarkers || []).forEach(function(m){ m.setMap(null); });
      window.__auditMarkers = ${JSON.stringify(items)}.map(function(p){
        var label = String(p.id).replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; });
        var size = p.big ? 14 : 8;
        return new naver.maps.Marker({
          position: new naver.maps.LatLng(p.lat, p.lng), map: map, zIndex: p.big ? 500 : 400, title: p.id,
          icon: { content: '<div style="transform:translate(-' + size / 2 + 'px,-' + size / 2 + 'px);display:flex;align-items:center;gap:4px;white-space:nowrap">'
            + '<span style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + p.color + ';border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.4)"></span>'
            + (p.big ? '<span style="font:600 11px sans-serif;color:' + p.color + ';background:rgba(255,255,255,.9);padding:1px 4px;border-radius:4px">' + label + '</span>' : '')
            + '</div>' }
        });
      });
    })(); true;`)
  }, [overlayPoints])

  const focus = (point: AuditPoint) => {
    setSelected(point.id)
    // 고른 지점에 이름표를 띄우고 그 자리로 옮긴다.
    webViewRef.current?.injectJavaScript(`(function(){
      if (typeof map === 'undefined') return;
      var pos = new naver.maps.LatLng(${point.lat}, ${point.lng});
      if (window.__auditFocus) window.__auditFocus.setMap(null);
      var label = ${JSON.stringify(point.id)}.replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; });
      window.__auditFocus = new naver.maps.Marker({ position: pos, map: map, zIndex: 900,
        icon: { content: '<div style="transform:translate(-9px,-9px);display:flex;align-items:center;gap:4px;white-space:nowrap">'
          + '<span style="width:18px;height:18px;border-radius:50%;border:3px solid #05014A;background:rgba(255,255,255,.6)"></span>'
          + '<span style="font:700 12px sans-serif;color:#fff;background:#05014A;padding:2px 6px;border-radius:5px">' + label + '</span></div>' } });
      map.setZoom(19); map.setCenter(pos);
    })(); true;`)
  }

  const t = audit.totals
  return { webViewRef, data, status, reload, mapHTML, audit, wide, selected, drawOverlay, focus, t }
}
