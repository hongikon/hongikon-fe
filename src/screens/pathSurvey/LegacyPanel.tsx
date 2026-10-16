import { Text, View } from 'react-native'
import { floorKeyOf, type LegacyOverlay } from './legacyOverlay'
import { Check, Section, ui } from './ui'

export interface LegacyToggles {
  plainNodes: boolean
  namedNodes: boolean
  /** 이름 지점 층별(floorKeyOf) 켜기. 키가 없으면 켠 것으로 본다. */
  namedFloors: Record<string, boolean>
  nodeEdges: boolean
  anchorEdges: boolean
}

export const DEFAULT_LEGACY: LegacyToggles = { plainNodes: true, namedNodes: true, namedFloors: {}, nodeEdges: true, anchorEdges: true }

/** 기존 자료(pathNodes.ts) 겹쳐 보기 토글. 보기 전용이라 조사 모듈과 잇거나 붙지 않는다. */
export default function LegacyPanel({
  overlay,
  toggles,
  onChange,
}: {
  overlay: LegacyOverlay
  toggles: LegacyToggles
  onChange: (next: LegacyToggles) => void
}) {
  const set = (patch: Partial<LegacyToggles>) => onChange({ ...toggles, ...patch })
  const unresolved = overlay.anchorEdges.filter((e) => !e.line)
  const countByFloor = (key: string) => overlay.namedNodes.filter((n) => floorKeyOf(n.floor) === key).length

  return (
    <View style={{ gap: 14 }}>
      <Section title="기존 자료 겹쳐 보기" help="pathNodes.ts 의 지점·간선을 회색으로 보여 줘요. 보기 전용이라 누를 수 없고, 조사 모듈과 잇거나 붙지 않아요." />
      <Check label={`지점 n* (${overlay.plainNodes.length})`} checked={toggles.plainNodes} onToggle={() => set({ plainNodes: !toggles.plainNodes })} color="#64748B" />
      <Check label={`이름 지점 HI_* (${overlay.namedNodes.length})`} checked={toggles.namedNodes} onToggle={() => set({ namedNodes: !toggles.namedNodes })} color="#64748B" />
      {toggles.namedNodes ? (
        <View style={{ paddingLeft: 24, gap: 2 }}>
          <Text style={ui.sectionHelp}>층은 id 의 '_2F_' 같은 조각에서 읽은 추정값이에요(데이터에 층 칸이 없어요).</Text>
          {overlay.namedFloorKeys.map((key) => (
            <Check
              key={key}
              label={`${key} (id 기반 추정) · ${countByFloor(key)}`}
              checked={toggles.namedFloors[key] !== false}
              onToggle={() => set({ namedFloors: { ...toggles.namedFloors, [key]: toggles.namedFloors[key] === false } })}
              color="#64748B"
            />
          ))}
        </View>
      ) : null}
      <Check label={`지점-지점 간선 (${overlay.nodeEdges.length})`} checked={toggles.nodeEdges} onToggle={() => set({ nodeEdges: !toggles.nodeEdges })} color="#64748B" />
      <Check
        label={`출입구 앵커 간선 (${overlay.anchorEdges.length - unresolved.length}/${overlay.anchorEdges.length} 위치 확인)`}
        checked={toggles.anchorEdges}
        onToggle={() => set({ anchorEdges: !toggles.anchorEdges })}
        color="#64748B"
      />
      <Section title="출입구 앵커 간선 목록" help="'건물명#라벨'은 지도 데이터의 건물·출입구로 풀어요(routing.ts 와 같은 방법). 못 푼 것은 지도에 그리지 않아요.">
        {overlay.anchorEdges.map((e) => (
          <Text key={`${e.a}|${e.b}`} style={e.line ? ui.hint : ui.warn}>
            {`${e.line ? '' : '[위치 모름] '}${e.a} — ${e.b}`}
          </Text>
        ))}
      </Section>
    </View>
  )
}
