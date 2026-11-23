import type { RefObject } from 'react'
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent } from 'react-native'
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg'
import { COLORS } from '../../../constants/colors'
import type { RoadMap } from '../../utils/roads/roadMap'

interface Blocked {
  edges: Set<string>
  entrances: Set<string>
  buildings: Set<string>
}

interface Props {
  map: RoadMap
  /** 임시 통제(공사·행사) — 빨간 점선 + 금지 표시. */
  closure: Blocked
  /** 상시 길 규칙 — 짙은 회색 점선(금지 표시 없음, 사용자에게도 금지로 보이지 않는다). */
  rule: Blocked
  /** 지금 고른 대상(구간 열쇠 또는 출입구 라벨). */
  selected: string | null
  /** 웹에서 누른 자리를 그림 좌표로 바꿀 때 쓰는 누름 칸. */
  pressRef: RefObject<View | null>
  onPress: (event: GestureResponderEvent) => void
}

const ROAD = '#9AA3AE'
const PICK = COLORS.primary
const BLOCKED = COLORS.danger
const RULE = '#475569'

/** 원 + 사선 금지 표시(Ionicons 'ban' 과 같은 모양). */
function Ban({ x, y, r }: { x: number; y: number; r: number }) {
  const d = r * 0.7
  return (
    <G pointerEvents="none">
      <Circle cx={x} cy={y} r={r + 1.5} fill="#fff" />
      <Circle cx={x} cy={y} r={r} fill="none" stroke={BLOCKED} strokeWidth={2.2} />
      <Path d={`M${x - d} ${y - d}L${x + d} ${y + d}`} stroke={BLOCKED} strokeWidth={2.2} strokeLinecap="round" />
    </G>
  )
}

/**
 * 길 관리 지도: 실외 길(회색 선)과 출입구(점)를 그리고, 누르면 고른다. 임시 통제는 빨간 점선 + 금지 표시, 상시 규칙은 짙은 회색 점선.
 * 지도 타일 없이 경로망만 그린다 — 건물 이름은 가운데에 작게.
 */
export function RoadNetworkMap({ map, closure, rule, selected, pressRef, onPress }: Props) {
  return (
    <ScrollView horizontal style={styles.frame} contentContainerStyle={styles.content}>
      <ScrollView nestedScrollEnabled style={styles.vertical}>
        <Pressable ref={pressRef} onPress={onPress} accessibilityLabel="경로망 지도 — 길 구간이나 출입구를 눌러 고릅니다">
          <Svg width={map.width} height={map.height} pointerEvents="none">
            {map.buildings.map((b) => (
              <G key={b.code} pointerEvents="none">
                <SvgText
                  x={b.at.x} y={b.at.y} fontSize={10} textAnchor="middle"
                  fill={closure.buildings.has(b.code) ? BLOCKED : rule.buildings.has(b.code) ? RULE : '#5B6470'}
                  fontWeight={closure.buildings.has(b.code) || rule.buildings.has(b.code) ? '700' : '400'}
                >
                  {rule.buildings.has(b.code) ? `${b.name} (통과 안 함)` : b.name}
                </SvgText>
                {closure.buildings.has(b.code) ? <Ban x={b.at.x} y={b.at.y - 14} r={6} /> : null}
              </G>
            ))}
            {map.edges.map((e) => {
              const closed = closure.edges.has(e.key)
              const ruled = rule.edges.has(e.key)
              const picked = selected === e.key
              return (
                <Line
                  key={e.key}
                  x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
                  stroke={picked ? PICK : closed ? BLOCKED : ruled ? RULE : ROAD}
                  strokeWidth={picked || closed || ruled ? 3.5 : 2}
                  strokeDasharray={closed || ruled ? '5 3' : e.stairs ? '2 2' : undefined}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              )
            })}
            {map.edges.filter((e) => closure.edges.has(e.key)).map((e) => (
              <Ban key={`ban-${e.key}`} x={(e.a.x + e.b.x) / 2} y={(e.a.y + e.b.y) / 2} r={6} />
            ))}
            {map.entrances.map((en) => {
              const blocked = closure.entrances.has(en.label)
              const ruled = rule.entrances.has(en.label)
              const picked = selected === en.label
              return (
                <G key={en.label} pointerEvents="none">
                  <Circle
                    cx={en.at.x} cy={en.at.y} r={picked ? 6 : 4}
                    fill={picked ? PICK : blocked ? '#fff' : ruled ? RULE : '#2F6FDE'} stroke="#fff" strokeWidth={1.5}
                  />
                  {blocked ? <Ban x={en.at.x} y={en.at.y} r={6} /> : null}
                </G>
              )
            })}
          </Svg>
        </Pressable>
      </ScrollView>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E3E6EA' },
  content: { padding: 4 },
  vertical: { maxHeight: 640 },
})
