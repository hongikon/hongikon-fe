import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import NaverMapView from '../components/map/NaverMapView'
import type { NaverMapViewHandle } from '../components/map/NaverMapView'
import BuildingSheet from '../components/map/BuildingSheet'
import FacilitySheet from '../components/map/FacilitySheet'
import { KindIcon } from '../components/map/ChipIcon'
import { buildMapHTML } from '../utils/mapHtml'
import { facilityMarkers } from '../utils/facilities'
import { FACILITY_KINDS, facilityKindLabel } from '../constants/facilityKinds'
import type { Building, FacilityKind } from '../types'
import { formatFloor } from '../utils/floors'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import {
  SOGANG_BUILDINGS,
  SOGANG_CENTER,
  SOGANG_EXTRAS,
  SOGANG_FACILITIES,
  SOGANG_OFFICE_DETAILS,
} from '../debug/sogangData'

/**
 * 개발용 `/dev/sogang` — 서강대 조사 데이터(`src/debug/sogangData.ts`)를 홍익대 지도와 같은 화면으로 본다.
 * 지도 페이지에 서강대 건물(외곽선)을 그리고, 위 칩으로 편의시설 핀을 켠다. 건물·핀을 누르면 앱과 같은 건물 시트·시설 시트·행정 부서 화면이 열린다.
 * 넓은 화면에서는 오른쪽에 전체 목록(칩에 없는 '기타' 포함)을 함께 보여 준다. 인증키 뒤에 있다(`DevSogangGate`). 검색엔진 noindex.
 */
/** `/dev/*` 는 앱 공통 틀(SafeAreaProvider 등)보다 먼저 갈라지므로, 시트가 쓰는 화면 여백 정보를 여기서 준다. */
export default function DevSogangScreen() {
  return (
    <SafeAreaProvider>
      <DevSogangMap />
    </SafeAreaProvider>
  )
}

function DevSogangMap() {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const mapHTML = useMemo(() => buildMapHTML(SOGANG_BUILDINGS), [])
  const { width } = useWindowDimensions()
  const wide = width >= 900
  const [kind, setKind] = useState<FacilityKind | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [facilityBuilding, setFacilityBuilding] = useState<string | null>(null)
  // 건물 시트에서 넘어온 시설 시트면 돌아갈 건물과 넘어오기 전 칩(앱의 지도 화면과 같은 동작).
  const [from, setFrom] = useState<{ building: Building; kind: FacilityKind | null } | null>(null)

  const post = useCallback((msg: object) => {
    webViewRef.current?.injectJavaScript(
      `if (typeof window.handleNativeMessage === "function") window.handleNativeMessage(${JSON.stringify(JSON.stringify(msg))});true;`,
    )
  }, [])

  const kinds = useMemo(
    () => FACILITY_KINDS.filter((k) => SOGANG_FACILITIES.some((f) => f.kind === k.key)),
    [],
  )

  const showKind = useCallback(
    (next: FacilityKind | null) => {
      setKind(next)
      if (next === null) post({ type: 'clearFacilities' })
      else post({ type: 'setFacilities', markers: facilityMarkers(SOGANG_FACILITIES, SOGANG_BUILDINGS, next), bounds: null })
    },
    [post],
  )

  // 지도 페이지가 (다시) 준비되면 서강대로 옮기고 지금 상태를 다시 그린다. 지도 페이지는 홍익대 범위로 묶여 있어 그 제한을 푼다.
  const onReady = useCallback(() => {
    webViewRef.current?.injectJavaScript(`(function(){
      if (typeof map === 'undefined' || !window.naver) return;
      map.setOptions({ minZoom: 10, maxBounds: null });
      map.setCenter(new naver.maps.LatLng(${SOGANG_CENTER.lat}, ${SOGANG_CENTER.lng})); map.setZoom(17);
    })(); true;`)
    if (kind) post({ type: 'setFacilities', markers: facilityMarkers(SOGANG_FACILITIES, SOGANG_BUILDINGS, kind), bounds: null })
  }, [kind, post])

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = '서강대 시설 미리보기 | 홍익온'
  }, [])

  const sheetOpen = facilityBuilding !== null
  useEffect(() => {
    post({ type: 'sheetOpen', open: sheetOpen })
  }, [sheetOpen, post])

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    let msg: { type?: string; name?: string; buildingName?: string }
    try {
      msg = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }
    if (msg.type === 'buildingTap') {
      const b = SOGANG_BUILDINGS.find((x) => x.name === msg.name) ?? null
      setFacilityBuilding(null)
      setFrom(null)
      setSelectedBuilding(b)
    } else if (msg.type === 'facilityTap') {
      setSelectedBuilding(null)
      setFrom(null)
      setFacilityBuilding(msg.buildingName ?? null)
    } else if (msg.type === 'buildingDismiss' || msg.type === 'sheetDismiss') {
      setSelectedBuilding(null)
      setFacilityBuilding(null)
      setFrom(null)
    }
  }, [])

  const openFromBuilding = (k: FacilityKind) => {
    if (!selectedBuilding) return
    setFrom({ building: selectedBuilding, kind })
    showKind(k)
    setFacilityBuilding(selectedBuilding.name)
    setSelectedBuilding(null)
    webViewRef.current?.injectJavaScript(
      `(function(){ if (typeof map === 'undefined') return; map.setZoom(19); map.setCenter(new naver.maps.LatLng(${selectedBuilding.lat}, ${selectedBuilding.lng})); })(); true;`,
    )
  }

  const backToBuilding = () => {
    if (!from) return
    showKind(from.kind)
    setFacilityBuilding(null)
    setSelectedBuilding(from.building)
    post({ type: 'selectBuilding', name: from.building.name })
    setFrom(null)
  }

  const closeBuilding = () => {
    setSelectedBuilding(null)
    post({ type: 'selectBuilding', name: null })
  }

  const buildingFacilities = selectedBuilding ? SOGANG_FACILITIES.filter((f) => f.buildingName === selectedBuilding.name) : []

  const panel = wide ? (
    <ScrollView style={styles.panel} contentContainerStyle={styles.panelBody}>
      <Text style={styles.title}>서강대 시설 미리보기 (/dev/sogang)</Text>
      <Text style={styles.summary}>
        {`건물 ${SOGANG_BUILDINGS.length}(외곽선 ${SOGANG_BUILDINGS.filter((b) => b.boundary).length}) · 시설 ${SOGANG_FACILITIES.length} · 기타 ${SOGANG_EXTRAS.length}`}
      </Text>
      <Text style={styles.hint}>건물을 누르면 건물 안 시설, 칩을 고르면 그 시설 핀이 떠요. 외곽선: © OpenStreetMap contributors</Text>
      {kinds.map((k) => {
        const items = SOGANG_FACILITIES.filter((f) => f.kind === k.key)
        return (
          <View key={k.key} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: k.color }]}>{`${facilityKindLabel(k.key)} ${items.length}`}</Text>
            {items.map((f) => (
              <Pressable
                key={f.id}
                style={styles.row}
                onPress={() => {
                  setSelectedBuilding(null)
                  setFrom(null)
                  showKind(k.key)
                  setFacilityBuilding(f.buildingName)
                }}
                accessibilityRole="button"
              >
                <Text style={styles.floor}>{f.floor !== undefined ? formatFloor(f.floor) : '-'}</Text>
                <View style={styles.rowMain}>
                  <Text style={styles.rowText}>{f.note?.split(' · ')[0]}</Text>
                  <Text style={styles.rowNote}>{f.buildingName}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )
      })}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: COLORS.textSecondary }]}>{`기타(칩 없음) ${SOGANG_EXTRAS.length}`}</Text>
        {SOGANG_EXTRAS.map((f) => (
          <View key={f.id} style={styles.row}>
            <Text style={styles.floor}>{f.floor !== undefined ? formatFloor(f.floor) : '-'}</Text>
            <View style={styles.rowMain}>
              <Text style={styles.rowText}>{f.note.split(' · ')[0]}</Text>
              <Text style={styles.rowNote}>{f.buildingName}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  ) : null

  return (
    <View style={[styles.container, wide && styles.containerWide]}>
      <View style={styles.mapArea}>
        <NaverMapView ref={webViewRef} html={mapHTML} onReady={onReady} onMessage={onMessage} />
        <ScrollView horizontal style={styles.chipBar} contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
          {kinds.map((k) => {
            const active = kind === k.key
            return (
              <Pressable
                key={k.key}
                onPress={() => {
                  setFacilityBuilding(null)
                  setFrom(null)
                  showKind(active ? null : k.key)
                }}
                style={[styles.chip, active && { backgroundColor: k.color, borderColor: k.color }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <KindIcon name={k.icon} size={13} color={active ? COLORS.white : k.color} />
                <Text style={[styles.chipText, active && { color: COLORS.white }]}>{facilityKindLabel(k.key)}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
        <View style={styles.sheetLayer} pointerEvents="box-none">
          {selectedBuilding && (
            <BuildingSheet
              key={selectedBuilding.name}
              building={selectedBuilding}
              facilities={buildingFacilities}
              onOpenFacility={openFromBuilding}
              onClose={closeBuilding}
              routeFindingEnabled={false}
              onSetFrom={() => {}}
              onSetTo={() => {}}
            />
          )}
          {facilityBuilding && kind && (
            <FacilitySheet
              key={`${kind}:${facilityBuilding}`}
              kind={kind}
              buildingName={facilityBuilding}
              items={SOGANG_FACILITIES.filter((f) => f.kind === kind && f.buildingName === facilityBuilding)}
              officeDetails={SOGANG_OFFICE_DETAILS}
              onClose={() => {
                setFacilityBuilding(null)
                setFrom(null)
              }}
              onBack={from ? backToBuilding : undefined}
              backLabel={from ? `${from.building.name}로 돌아가기` : undefined}
            />
          )}
        </View>
      </View>
      {panel}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  containerWide: { flexDirection: 'row' },
  mapArea: { flex: 1, minHeight: 320 },
  chipBar: { position: 'absolute', top: 12, left: 0, right: 0, flexGrow: 0 },
  chips: { paddingHorizontal: 12, gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  sheetLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: 400, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: COLORS.border },
  panelBody: { padding: 16, gap: 14 },
  title: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.textPrimary },
  summary: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.textSecondary, marginTop: -8 },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  section: { gap: 2 },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 13.5, marginBottom: 2 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 6 },
  floor: { width: 30, fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.textSecondary },
  rowMain: { flex: 1, gap: 1 },
  rowText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  rowNote: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textTertiary },
})
