import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import NaverMapView from '../components/map/NaverMapView'
import type { NaverMapViewHandle } from '../components/map/NaverMapView'
import { buildMapHTML } from '../utils/mapHtml'
import { useMapData } from '../lib/mapData'
import { PATH_EDGES, PATH_WAYPOINTS } from '../constants/pathNodes'
import { auditPathNetwork, type AuditPoint } from '../utils/pathAudit'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'

/** 지도 위 점 색 — 목록 머리줄 색과 같다. */
const KIND_COLOR = {
  broken: '#B91C1C',
  isolated: '#DC2626',
  detached: '#EA580C',
  entrance: '#7C3AED',
  building: '#475569',
} as const
type Kind = keyof typeof KIND_COLOR

/**
 * 개발용 `/dev/path` — 실외 보행 경로망(src/constants/pathNodes.ts)을 지도에 띄우고, 길찾기에서 빠지는 것들을 목록으로 보여 준다.
 * 경로망 선은 `/temp/path-nodes` 와 같은 지도 페이지('nodes' 모드)로 그리고, 문제 지점은 색 점 + 이름표로 덧그린다.
 * 목록을 누르면 그 자리로 지도가 옮겨 간다. 운영 웹에서는 열리지 않는다(SHOW_DEVELOPER_TOOLS, App.tsx).
 */
export default function DevPathAuditScreen() {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const { buildings, data, status, reload } = useMapData()
  const mapHTML = useMemo(() => buildMapHTML(buildings, 'nodes'), [buildings])
  const audit = useMemo(() => auditPathNetwork(PATH_WAYPOINTS, PATH_EDGES, buildings), [buildings])
  const { width } = useWindowDimensions()
  const wide = width >= 900
  const [selected, setSelected] = useState<string | null>(null)

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

  const row = (point: AuditPoint, kind: Kind, note?: string) => (
    <Pressable
      key={`${kind}:${point.id}`}
      onPress={() => focus(point)}
      style={[styles.row, selected === point.id && styles.rowSelected]}
      accessibilityRole="button"
      accessibilityLabel={`${point.id} 지도에서 보기`}
    >
      <View style={[styles.dot, { backgroundColor: KIND_COLOR[kind] }]} />
      <Text style={styles.rowText} numberOfLines={2}>
        {point.id}
        {note ? <Text style={styles.rowNote}>{`  ${note}`}</Text> : null}
      </Text>
    </Pressable>
  )

  const t = audit.totals
  const panel = (
    <ScrollView style={wide ? styles.panelWide : styles.panelNarrow} contentContainerStyle={styles.panelBody}>
      <Text style={styles.title}>경로망 점검 (/dev/path)</Text>
      <Text style={styles.summary}>
        지점 {t.waypoints} · 간선 {t.edges} · 건물 {t.buildings} · 출입구 {t.entrances} · 연결 덩어리 {t.groups}
      </Text>
      <Text style={styles.hint}>목록을 누르면 그 자리로 이동해요. 선은 /temp/path-nodes 와 같은 경로망 그림이에요.</Text>

      <Section title="이어지지 않는 간선" count={audit.brokenEdges.length} color={KIND_COLOR.broken}
        empty="없음 — 모든 간선의 양 끝을 찾았어요"
        help="한쪽 끝 이름을 지점·건물·출입구 어디서도 못 찾아 길찾기에서 통째로 빠지는 간선">
        {audit.brokenEdges.map(({ index, edge, missing }) => (
          <View key={index} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: KIND_COLOR.broken }]} />
            <Text style={styles.rowText}>
              {`#${index}  ${edge[0]} — ${edge[1]}`}
              <Text style={styles.rowNote}>{`  못 찾음: ${missing.join(', ')}`}</Text>
            </Text>
          </View>
        ))}
      </Section>

      <Section title="연결 안 된 지점" count={audit.isolatedWaypoints.length} color={KIND_COLOR.isolated} empty="없음"
        help="좌표만 있고 어떤 간선에도 안 쓰인 지점">
        {audit.isolatedWaypoints.map((point) => row(point, 'isolated'))}
      </Section>

      <Section title="본망과 끊긴 덩어리" count={audit.detachedGroups.length} color={KIND_COLOR.detached}
        empty="없음 — 한 덩어리로 이어져 있어요" help="서로는 이어졌지만 가장 큰 망과 오갈 수 없는 묶음">
        {audit.detachedGroups.map((group, i) => (
          <View key={i} style={styles.group}>
            <Text style={styles.groupTitle}>{`덩어리 ${i + 1} · ${group.length}개`}</Text>
            {group.map((point) => row(point, 'detached'))}
          </View>
        ))}
      </Section>

      <Section title="망에 안 이어진 출입구" count={audit.unconnectedEntrances.length} color={KIND_COLOR.entrance} empty="없음">
        {audit.unconnectedEntrances.map((point) => row(point, 'entrance'))}
      </Section>

      <Section title="망에 안 이어진 건물" count={audit.unconnectedBuildings.length} color={KIND_COLOR.building}
        empty="없음 — 모든 건물이 망에 닿아요" help="이 건물로 가는 길찾기는 직선 거리 추정으로 대체돼요">
        {audit.unconnectedBuildings.map((point) => row(point, 'building'))}
      </Section>

      <Section title="비어 있는 지점 번호" count={audit.missingNumbers.length} color={COLORS.textSecondary} empty="없음">
        <Text style={styles.numbers}>{audit.missingNumbers.join(', ')}</Text>
      </Section>
    </ScrollView>
  )

  return (
    <View style={[styles.container, wide && styles.containerWide]}>
      <View style={styles.mapArea}>
        {!data ? (
          <Text style={styles.loading} onPress={status === 'error' ? reload : undefined}>
            {status === 'error' ? '지도 정보를 불러오지 못했어요 · 다시 시도' : '지도 정보를 불러오는 중이에요'}
          </Text>
        ) : (
          <NaverMapView key={data.version} ref={webViewRef} html={mapHTML} onReady={drawOverlay} onMessage={() => {}} />
        )}
      </View>
      {panel}
    </View>
  )
}

function Section({
  title,
  count,
  color,
  empty,
  help,
  children,
}: {
  title: string
  count: number
  color: string
  empty: string
  help?: string
  children: ReactNode
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color }]}>{`${title} ${count}`}</Text>
      {help ? <Text style={styles.sectionHelp}>{help}</Text> : null}
      {count > 0 ? children : <Text style={styles.empty}>{empty}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  containerWide: { flexDirection: 'row' },
  mapArea: { flex: 1, minHeight: 320 },
  loading: { padding: 20, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  panelWide: { width: 400, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: COLORS.border },
  panelNarrow: { maxHeight: '45%', borderTopWidth: 1, borderTopColor: COLORS.border },
  panelBody: { padding: 16, gap: 16 },
  title: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.textPrimary },
  summary: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.textSecondary, marginTop: -10 },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginTop: -10 },
  section: { gap: 4 },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 13.5 },
  sectionHelp: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textTertiary },
  empty: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textTertiary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 6 },
  rowSelected: { backgroundColor: COLORS.fill },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { flex: 1, fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.textPrimary },
  rowNote: { fontFamily: FONTS.regular, color: COLORS.textTertiary },
  group: { gap: 2, marginBottom: 6 },
  groupTitle: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  numbers: { fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 19, color: COLORS.textSecondary },
})
