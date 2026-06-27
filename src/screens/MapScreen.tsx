import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, {
  Rect,
  Circle,
  Line,
  Ellipse,
  Text as SvgText,
  G,
  Polyline,
  Path,
} from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { BUILDINGS } from '../constants/buildings'
import type { Building } from '../types'

const MAP_WIDTH = 316
const MAP_HEIGHT = 488

interface RoutePoint {
  x: number
  y: number
}

function getRoutePoints(from: Building, to: Building): RoutePoint[] {
  return [
    { x: from.cx, y: from.cy },
    { x: from.anchorX, y: from.cy },
    { x: from.anchorX, y: from.anchorY },
    { x: to.anchorX, y: from.anchorY },
    { x: to.anchorX, y: to.cy },
    { x: to.cx, y: to.cy },
  ]
}

function getRouteMinutes(points: RoutePoint[]): number {
  let dist = 0
  for (let i = 1; i < points.length; i++) {
    dist += Math.sqrt(
      Math.pow(points[i].x - points[i - 1].x, 2) +
      Math.pow(points[i].y - points[i - 1].y, 2)
    )
  }
  return Math.max(1, Math.round(dist * 1.3 / 66))
}

export default function MapScreen() {
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [fromBuilding, setFromBuilding] = useState<Building | null>(null)
  const [toBuilding, setToBuilding] = useState<Building | null>(null)
  const [showRoute, setShowRoute] = useState(false)
  const [routeTarget, setRouteTarget] = useState<'from' | 'to' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const routePoints = fromBuilding && toBuilding
    ? getRoutePoints(fromBuilding, toBuilding)
    : null
  const routeMinutes = routePoints ? getRouteMinutes(routePoints) : 0

  const filteredBuildings = searchQuery.trim()
    ? BUILDINGS.filter((b) => b.name.includes(searchQuery.trim()))
    : BUILDINGS

  const handleBuildingPress = useCallback((building: Building) => {
    setSelectedBuilding(building)
  }, [])

  const handleClosePopup = useCallback(() => {
    setSelectedBuilding(null)
  }, [])

  const handleSetFrom = useCallback(() => {
    if (!selectedBuilding) return
    setFromBuilding(selectedBuilding)
    setSelectedBuilding(null)
  }, [selectedBuilding])

  const handleSetTo = useCallback(() => {
    if (!selectedBuilding) return
    setToBuilding(selectedBuilding)
    setSelectedBuilding(null)
  }, [selectedBuilding])

  const handleClearRoute = useCallback(() => {
    setFromBuilding(null)
    setToBuilding(null)
  }, [])

  const handleOpenRoute = useCallback(() => {
    setShowRoute(true)
    setRouteTarget(null)
    setSearchQuery('')
  }, [])

  const handleSelectRouteBuilding = useCallback((building: Building) => {
    if (routeTarget === 'from') {
      setFromBuilding(building)
    } else if (routeTarget === 'to') {
      setToBuilding(building)
    }
    setRouteTarget(null)
    setSearchQuery('')
  }, [routeTarget])

  const handleCloseRoute = useCallback(() => {
    setShowRoute(false)
    setRouteTarget(null)
    setSearchQuery('')
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>캠퍼스</Text>
      </View>

      <TouchableOpacity style={styles.searchBar} activeOpacity={0.7}>
        <Ionicons name="search" size={16} color="#999" />
        <Text style={styles.searchPlaceholder}>건물명, 시설명 검색</Text>
      </TouchableOpacity>

      <View style={styles.mapArea}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
          <Rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#EEF3EA" />

          <Line x1={75} y1={0} x2={75} y2={MAP_HEIGHT} stroke="#D8D3BC" strokeWidth={12} />
          <Line x1={232} y1={0} x2={232} y2={MAP_HEIGHT} stroke="#D8D3BC" strokeWidth={12} />
          <Line x1={153} y1={0} x2={153} y2={MAP_HEIGHT} stroke="#D8D3BC" strokeWidth={8} />
          <Line x1={0} y1={95} x2={MAP_WIDTH} y2={95} stroke="#D8D3BC" strokeWidth={12} />
          <Line x1={0} y1={195} x2={MAP_WIDTH} y2={195} stroke="#D8D3BC" strokeWidth={12} />
          <Line x1={0} y1={310} x2={MAP_WIDTH} y2={310} stroke="#D8D3BC" strokeWidth={12} />
          <Line x1={0} y1={380} x2={MAP_WIDTH} y2={380} stroke="#D8D3BC" strokeWidth={8} />

          <Rect x={4} y={4} width={65} height={85} rx={5} fill="#CAD6C2" stroke="#B5C4AE" strokeWidth={1} />
          <Rect x={83} y={4} width={64} height={85} rx={5} fill="#CAD6C2" stroke="#B5C4AE" strokeWidth={1} />
          <Rect x={159} y={4} width={67} height={85} rx={5} fill="#CAD6C2" stroke="#B5C4AE" strokeWidth={1} />
          <Rect x={238} y={4} width={74} height={85} rx={5} fill="#D2DAC9" stroke="#B5C4AE" strokeWidth={1} />
          <Rect x={4} y={103} width={65} height={86} rx={5} fill="#CAD6C2" stroke="#B5C4AE" strokeWidth={1} />
          <Rect x={159} y={103} width={67} height={86} rx={5} fill="#CAD6C2" stroke="#B5C4AE" strokeWidth={1} />
          <Rect x={238} y={103} width={74} height={86} rx={5} fill="#D2DAC9" stroke="#B5C4AE" strokeWidth={1} />
          <Rect x={4} y={203} width={65} height={100} rx={5} fill="#CAD6C2" stroke="#B5C4AE" strokeWidth={1} />
          <Rect x={83} y={203} width={64} height={100} rx={5} fill="#CAD6C2" stroke="#B5C4AE" strokeWidth={1} />
          <Rect x={238} y={203} width={74} height={100} rx={5} fill="#CAD6C2" stroke="#B5C4AE" strokeWidth={1} />
          <Rect x={4} y={318} width={65} height={56} rx={5} fill="#CAD6C2" stroke="#B5C4AE" strokeWidth={1} />

          <Ellipse cx={193} cy={418} rx={68} ry={50} fill="#BCD898" stroke="#98C478" strokeWidth={1.5} />
          <Ellipse cx={193} cy={418} rx={52} ry={36} fill="none" stroke="#98C478" strokeWidth={1} strokeDasharray="5,3" />

          <Circle cx={150} cy={44} r={14} fill="#A8CC90" opacity={0.8} />
          <Circle cx={140} cy={52} r={10} fill="#90B87C" opacity={0.8} />
          <Circle cx={272} cy={152} r={12} fill="#A8CC90" opacity={0.75} />
          <Circle cx={150} cy={264} r={11} fill="#A8CC90" opacity={0.75} />
          <Circle cx={86} cy={356} r={11} fill="#A8CC90" opacity={0.75} />

          <SvgText x={275} y={52} textAnchor="middle" fontSize={16} fill="#2563EB" fontWeight="bold">P</SvgText>
          <SvgText x={193} y={472} textAnchor="middle" fontSize={10} fill="#888">후문</SvgText>
          <Line x1={193} y1={460} x2={193} y2={469} stroke="#aaa" strokeWidth={1} />
          <SvgText x={193} y={486} textAnchor="middle" fontSize={10} fill="#888">정문</SvgText>

          {routePoints && (
            <Polyline
              points={routePoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={COLORS.routeLine}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="8,4"
              opacity={0.88}
            />
          )}

          {fromBuilding && (
            <G x={fromBuilding.cx} y={fromBuilding.cy}>
              <Circle r={13} fill={COLORS.routeFrom} stroke="#fff" strokeWidth={2.5} />
              <SvgText y={1} textAnchor="middle" fontSize={8} fill="#fff" fontWeight="bold">출발</SvgText>
            </G>
          )}
          {toBuilding && (
            <G x={toBuilding.cx} y={toBuilding.cy}>
              <Circle r={13} fill={COLORS.routeTo} stroke="#fff" strokeWidth={2.5} />
              <SvgText y={1} textAnchor="middle" fontSize={8} fill="#fff" fontWeight="bold">도착</SvgText>
            </G>
          )}

          {BUILDINGS.map((b) => (
            <G key={b.name} onPress={() => handleBuildingPress(b)}>
              <Circle cx={b.cx} cy={b.cy} r={12} fill={b.color} stroke="#fff" strokeWidth={2} />
              <SvgText x={b.cx} y={b.cy + 16} textAnchor="middle" fontSize={8.5} fill="#4A5568">
                {b.name}
              </SvgText>
            </G>
          ))}

          <G x={160} y={175}>
            <Ellipse cx={0} cy={16} rx={9} ry={5} fill="rgba(5,1,74,0.2)" />
            <Path d="M0,-22C-11,-22-18,-13-18,-5C-18,8 0,26 0,26C0,26 18,8 18,-5C18,-13 11,-22 0,-22Z" fill={COLORS.primary} />
            <Circle cx={0} cy={-5} r={7} fill="#fff" />
            <Circle cx={0} cy={-5} r={3} fill={COLORS.primary} />
          </G>
        </Svg>

        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.controlBtn} onPress={handleOpenRoute}>
            <Ionicons name="navigate" size={17} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn}>
            <Ionicons name="locate-outline" size={17} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {fromBuilding && toBuilding && (
          <View style={styles.routeStrip}>
            <View style={styles.routeInfo}>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.routeFrom }]} />
                <Text style={styles.routeLabel} numberOfLines={1}>{fromBuilding.name}</Text>
              </View>
              <Text style={styles.routeArrow}>→</Text>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.routeTo }]} />
                <Text style={styles.routeLabel} numberOfLines={1}>{toBuilding.name}</Text>
              </View>
            </View>
            <Text style={styles.routeTime}>도보 {routeMinutes}분</Text>
            <TouchableOpacity onPress={handleClearRoute} style={styles.routeCloseBtn}>
              <Ionicons name="close" size={16} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {selectedBuilding && (
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <View style={[styles.sheetDot, { backgroundColor: selectedBuilding.color }]} />
                <Text style={styles.sheetName}>{selectedBuilding.name}</Text>
              </View>
              <TouchableOpacity onPress={handleClosePopup}>
                <Ionicons name="close" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetType}>
              {selectedBuilding.type} · 지상 {selectedBuilding.floors}층
            </Text>
            <View style={styles.sheetHoursRow}>
              <Ionicons name="time-outline" size={13} color={COLORS.primary} />
              <Text style={styles.sheetHours}>{selectedBuilding.hours}</Text>
            </View>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.actionFrom} onPress={handleSetFrom}>
                <Ionicons name="location" size={14} color={COLORS.routeFrom} />
                <Text style={styles.actionFromText}>출발</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionTo} onPress={handleSetTo}>
                <Ionicons name="flag" size={14} color={COLORS.routeTo} />
                <Text style={styles.actionToText}>도착</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Modal visible={showRoute} animationType="slide">
        <SafeAreaView style={styles.routeModal} edges={['top']}>
          <View style={styles.routeModalHeader}>
            <TouchableOpacity onPress={handleCloseRoute}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.routeModalTitle}>길찾기</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.routeInputs}>
            <TouchableOpacity
              style={[styles.routeInputRow, routeTarget === 'from' && styles.routeInputActive]}
              onPress={() => { setRouteTarget('from'); setSearchQuery('') }}
            >
              <View style={[styles.inputDot, { backgroundColor: COLORS.routeFrom }]} />
              <Text style={fromBuilding ? styles.inputFilled : styles.inputPlaceholder}>
                {fromBuilding ? fromBuilding.name : '출발지 입력'}
              </Text>
            </TouchableOpacity>
            <View style={styles.inputDivider} />
            <TouchableOpacity
              style={[styles.routeInputRow, routeTarget === 'to' && styles.routeInputActive]}
              onPress={() => { setRouteTarget('to'); setSearchQuery('') }}
            >
              <View style={[styles.inputDot, { backgroundColor: COLORS.routeTo }]} />
              <Text style={toBuilding ? styles.inputFilled : styles.inputPlaceholder}>
                {toBuilding ? toBuilding.name : '도착지 입력'}
              </Text>
            </TouchableOpacity>
          </View>

          {routeTarget && (
            <View style={styles.routeSearch}>
              <View style={styles.routeSearchBar}>
                <Ionicons name="search" size={16} color="#999" />
                <TextInput
                  style={styles.routeSearchInput}
                  placeholder="건물 검색"
                  placeholderTextColor="#bbb"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
              </View>
              <FlatList
                data={filteredBuildings}
                keyExtractor={(item) => item.name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.buildingItem}
                    onPress={() => handleSelectRouteBuilding(item)}
                  >
                    <View style={[styles.buildingItemDot, { backgroundColor: item.color }]} />
                    <View style={styles.buildingItemInfo}>
                      <Text style={styles.buildingItemName}>{item.name}</Text>
                      <Text style={styles.buildingItemType}>{item.type}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#ddd" />
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.buildingList}
              />
            </View>
          )}

          {!routeTarget && fromBuilding && toBuilding && (
            <View style={styles.routeResultCard}>
              <View style={styles.routeResultRow}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.routeFrom }]} />
                <Text style={styles.routeResultName}>{fromBuilding.name}</Text>
              </View>
              <View style={styles.routeResultDivider}>
                <View style={styles.routeResultLine} />
                <Text style={styles.routeResultTime}>도보 약 {routeMinutes}분</Text>
              </View>
              <View style={styles.routeResultRow}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.routeTo }]} />
                <Text style={styles.routeResultName}>{toBuilding.name}</Text>
              </View>
              <TouchableOpacity style={styles.routeStartBtn} onPress={handleCloseRoute}>
                <Text style={styles.routeStartText}>경로 보기</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchPlaceholder: { fontSize: 13, color: '#bbb' },
  mapArea: { flex: 1, position: 'relative' },
  mapControls: { position: 'absolute', right: 12, bottom: 20, gap: 8 },
  controlBtn: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  routeStrip: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  routeInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeLabel: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  routeArrow: { fontSize: 12, color: '#ccc' },
  routeTime: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  routeCloseBtn: { padding: 2 },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetDot: { width: 10, height: 10, borderRadius: 5 },
  sheetName: { fontSize: 17, fontWeight: '600', color: COLORS.textPrimary },
  sheetType: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10, paddingLeft: 18 },
  sheetHoursRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#f0f0f0',
    marginBottom: 14,
  },
  sheetHours: { fontSize: 12, color: '#666', lineHeight: 20 },
  sheetActions: { flexDirection: 'row', gap: 10 },
  actionFrom: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EDFAF3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionFromText: { fontSize: 13, color: COLORS.routeFrom, fontWeight: '600' },
  actionTo: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EEF0FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionToText: { fontSize: 13, color: COLORS.routeTo, fontWeight: '600' },
  routeModal: { flex: 1, backgroundColor: COLORS.white },
  routeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  routeModalTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  routeInputs: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    overflow: 'hidden',
  },
  routeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  routeInputActive: { backgroundColor: '#EEF0FA' },
  inputDot: { width: 10, height: 10, borderRadius: 5 },
  inputPlaceholder: { fontSize: 14, color: '#bbb' },
  inputFilled: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  inputDivider: { height: 0.5, backgroundColor: '#E8E8E8', marginHorizontal: 14 },
  routeSearch: { flex: 1, marginTop: 12 },
  routeSearchBar: {
    marginHorizontal: 16,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
    marginBottom: 8,
  },
  routeSearchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  buildingList: { paddingHorizontal: 16 },
  buildingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f4f4f4',
    gap: 10,
  },
  buildingItemDot: { width: 10, height: 10, borderRadius: 5 },
  buildingItemInfo: { flex: 1 },
  buildingItemName: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  buildingItemType: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  routeResultCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    padding: 16,
  },
  routeResultRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeResultName: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  routeResultDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 3,
  },
  routeResultLine: { width: 2, height: 20, backgroundColor: '#ddd', borderRadius: 1 },
  routeResultTime: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  routeStartBtn: {
    marginTop: 14,
    height: 42,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeStartText: { fontSize: 14, color: '#fff', fontWeight: '600' },
})
