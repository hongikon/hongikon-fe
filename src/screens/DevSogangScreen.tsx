import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import NaverMapView from '../components/map/NaverMapView'
import type { NaverMapViewHandle } from '../components/map/NaverMapView'
import { buildMapHTML } from '../utils/mapHtml'
import { FACILITY_KINDS, facilityKindLabel } from '../constants/facilityKinds'
import type { FacilityKind } from '../types'
import { formatFloor } from '../utils/floors'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { SOGANG_BUILDINGS, SOGANG_CENTER, SOGANG_FACILITIES, type SogangFacility } from '../debug/sogangData'

/** 칩에 없는 종류(조사에서 따로 모은 것)의 색. */
const EXTRA_COLOR: Record<string, string> = { '은행·ATM': '#0F766E', 기타: '#64748B' }
const KIND_ORDER = [...FACILITY_KINDS.map((k) => k.key as string), '은행·ATM', '기타']

function kindColor(kind: string): string {
  return FACILITY_KINDS.find((k) => k.key === kind)?.color ?? EXTRA_COLOR[kind] ?? COLORS.primary
}
function kindLabel(kind: string): string {
  return FACILITY_KINDS.some((k) => k.key === kind) ? facilityKindLabel(kind as FacilityKind) : kind
}

/**
 * 개발용 `/dev/sogang` — 서강대 시설 조사 결과(`src/debug/sogangData.ts`)를 지도와 목록으로 미리 본다.
 * 다른 학교 데이터를 앱에 넣기 전에 칩 종류별로 얼마나 모였는지, 위치가 맞는지 눈으로 확인하는 화면이다.
 * 지도는 홍익온 지도 페이지를 건물 없이 띄우고, 서강대 건물 점·시설 수를 덧그린다(`/dev/path` 와 같은 방식).
 * 칩을 고르면 그 종류가 있는 건물만, 목록 줄을 누르면 그 건물로 옮긴다. 검색엔진에는 안 걸리게 noindex.
 */
export default function DevSogangScreen() {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const mapHTML = useMemo(() => buildMapHTML([]), [])
  const { width } = useWindowDimensions()
  const wide = width >= 900
  const [kind, setKind] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    document.title = '서강대 시설 미리보기 | 홍익온'
    return () => {
      meta.remove()
    }
  }, [])

  const counts = useMemo(() => {
    const c = new Map<string, number>()
    SOGANG_FACILITIES.forEach((f) => c.set(f.kind, (c.get(f.kind) ?? 0) + 1))
    return c
  }, [])
  const kinds = KIND_ORDER.filter((k) => counts.has(k))
  const shown = useMemo(() => (kind ? SOGANG_FACILITIES.filter((f) => f.kind === kind) : SOGANG_FACILITIES), [kind])

  // 건물마다 점 하나 + 이름 + (고른 종류의) 시설 수.
  const drawOverlay = useCallback(() => {
    const perBuilding = new Map<string, number>()
    shown.forEach((f) => perBuilding.set(f.building, (perBuilding.get(f.building) ?? 0) + 1))
    const color = kind ? kindColor(kind) : COLORS.primary
    const items = SOGANG_BUILDINGS.map((b) => ({ name: b.name, lat: b.lat, lng: b.lng, n: perBuilding.get(b.name) ?? 0 }))
    webViewRef.current?.injectJavaScript(`(function(){
      if (typeof map === 'undefined' || !window.naver) return;
      map.setOptions({ minZoom: 10, maxBounds: null });
      if (!window.__sgCentered) { window.__sgCentered = true; map.setCenter(new naver.maps.LatLng(${SOGANG_CENTER.lat}, ${SOGANG_CENTER.lng})); map.setZoom(17); }
      (window.__sgMarkers || []).forEach(function(m){ m.setMap(null); });
      var esc = function(s){ return String(s).replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); };
      var filtered = ${kind ? 'true' : 'false'};
      window.__sgMarkers = ${JSON.stringify(items)}.filter(function(p){ return !filtered || p.n > 0; }).map(function(p){
        var badge = p.n > 0 ? '<span style="min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:${color};color:#fff;font:700 11px sans-serif;display:inline-flex;align-items:center;justify-content:center">' + p.n + '</span>' : '<span style="width:8px;height:8px;border-radius:50%;background:#94A3B8;border:2px solid #fff"></span>';
        return new naver.maps.Marker({ position: new naver.maps.LatLng(p.lat, p.lng), map: map, zIndex: p.n > 0 ? 500 : 300, title: p.name,
          icon: { content: '<div style="transform:translate(-9px,-9px);display:flex;align-items:center;gap:4px;white-space:nowrap">' + badge
            + '<span style="font:600 11px sans-serif;color:#1E293B;background:rgba(255,255,255,.88);padding:1px 4px;border-radius:4px">' + esc(p.name) + '</span></div>' } });
      });
    })(); true;`)
  }, [shown, kind])

  useEffect(() => {
    drawOverlay()
  }, [drawOverlay])

  const focus = (f: SogangFacility, key: string) => {
    setSelected(key)
    const b = SOGANG_BUILDINGS.find((x) => x.name === f.building)
    if (!b) return
    webViewRef.current?.injectJavaScript(`(function(){
      if (typeof map === 'undefined') return;
      map.setZoom(19); map.setCenter(new naver.maps.LatLng(${b.lat}, ${b.lng}));
    })(); true;`)
  }

  const grouped = useMemo(() => {
    const g = new Map<string, SogangFacility[]>()
    shown.forEach((f) => g.set(f.kind, [...(g.get(f.kind) ?? []), f]))
    return KIND_ORDER.filter((k) => g.has(k)).map((k) => [k, g.get(k)!] as const)
  }, [shown])

  const panel = (
    <ScrollView style={wide ? styles.panelWide : styles.panelNarrow} contentContainerStyle={styles.panelBody}>
      <Text style={styles.title}>서강대 시설 미리보기 (/dev/sogang)</Text>
      <Text style={styles.summary}>
        건물 {SOGANG_BUILDINGS.length} · 시설 {SOGANG_FACILITIES.length} · 2026-10-14 공식 홈페이지 기준
      </Text>
      <View style={styles.chips}>
        <Chip label={`전체 ${SOGANG_FACILITIES.length}`} active={kind === null} color={COLORS.primary} onPress={() => setKind(null)} />
        {kinds.map((k) => (
          <Chip key={k} label={`${kindLabel(k)} ${counts.get(k)}`} active={kind === k} color={kindColor(k)} onPress={() => setKind(kind === k ? null : k)} />
        ))}
      </View>
      <Text style={styles.hint}>칩에 없는 칸(스터디룸·정수기·수면실·흡연구역·엘리베이터)은 공식 페이지에 정보가 없어요.</Text>
      {grouped.map(([k, items]) => (
        <View key={k} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: kindColor(k) }]}>{`${kindLabel(k)} ${items.length}`}</Text>
          {items.map((f, i) => {
            const key = `${k}:${i}:${f.name}:${f.where}`
            return (
              <Pressable key={key} onPress={() => focus(f, key)} style={[styles.row, selected === key && styles.rowSelected]}
                accessibilityRole="button" accessibilityLabel={`${f.name} 지도에서 보기`}>
                <Text style={styles.floor}>{f.floor !== undefined ? formatFloor(f.floor) : '-'}</Text>
                <View style={styles.rowMain}>
                  <Text style={styles.rowText}>{f.name}</Text>
                  <Text style={styles.rowNote}>{[f.building, f.where !== f.building ? f.where : null].filter(Boolean).join(' · ')}</Text>
                  {f.hours || f.phone ? <Text style={styles.rowNote}>{[f.hours, f.phone].filter(Boolean).join(' · ')}</Text> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
    </ScrollView>
  )

  return (
    <View style={[styles.container, wide && styles.containerWide]}>
      <View style={styles.mapArea}>
        <NaverMapView ref={webViewRef} html={mapHTML} onReady={drawOverlay} onMessage={() => {}} />
      </View>
      {panel}
    </View>
  )
}

function Chip({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, { borderColor: color }, active && { backgroundColor: color }]} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, { color: active ? COLORS.white : color }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  containerWide: { flexDirection: 'row' },
  mapArea: { flex: 1, minHeight: 320 },
  panelWide: { width: 420, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: COLORS.border },
  panelNarrow: { maxHeight: '50%', borderTopWidth: 1, borderTopColor: COLORS.border },
  panelBody: { padding: 16, gap: 14 },
  title: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.textPrimary },
  summary: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.textSecondary, marginTop: -8 },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  chipText: { fontFamily: FONTS.semibold, fontSize: 12 },
  section: { gap: 2 },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 13.5, marginBottom: 2 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 6 },
  rowSelected: { backgroundColor: COLORS.fill },
  floor: { width: 30, fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.textSecondary },
  rowMain: { flex: 1, gap: 1 },
  rowText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  rowNote: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textTertiary, lineHeight: 16 },
})
