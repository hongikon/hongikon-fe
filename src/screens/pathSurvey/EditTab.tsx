import { StyleSheet, Text, TextInput, View } from 'react-native'
import { FONTS } from '../../constants/typography'
import { NODE_KIND_INFO, type SurveyEdgeKind, type SurveyModule, type SurveyNode, type SurveyNodeKind } from '../../utils/pathSurveyStore'
import EdgePanel from './EdgePanel'
import Legend from './Legend'
import { MODES, type Mode } from './screenModel'
import { Btn, Check, Row, Section, shortId, ui } from './ui'

interface Props {
  active: SurveyModule | undefined
  mode: Mode
  onMode: (mode: Mode) => void
  chain: boolean
  onToggleChain: () => void
  pending: string | null
  selectedNode: SurveyNode | undefined
  onNodeMemo: (id: string, text: string) => void
  onNodeKind: (id: string, kind: SurveyNodeKind | undefined) => void
  onDeleteSelected: () => void
  onUndo: () => void
  onFinish: (id: string) => void
  onStart: () => void
  selectedEdge: string | null
  onSelectEdge: (id: string | null) => void
  onEdgeMemo: (id: string, text: string) => void
  onEdgeKind: (id: string, kind: SurveyEdgeKind | undefined) => void
  onDeleteEdge: (id: string) => void
}

/** v2 "편집" 탭: 지도 모드, 이어 찍기, 고른 지점(메모·성질·지우기), 되돌리기·모듈 마치기·새 모듈, 간선 목록, 범례. */
export default function EditTab(props: Props) {
  const { active, mode, chain, pending, selectedNode } = props
  const activeMode = MODES.find((m) => m.key === mode)!
  return (
    <>
      {!active ? <Text style={ui.warn}>편집 중인 모듈이 없어요. 아래 "새 모듈 시작"을 누르거나 "모듈" 탭에서 이어서 편집할 모듈을 고르세요.</Text> : null}
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Btn key={m.key} label={m.label} kind={mode === m.key ? 'active' : 'default'} onPress={() => props.onMode(m.key)} style={{ flex: 1 }} />
        ))}
      </View>
      <Text style={ui.hint}>{activeMode.help}</Text>
      {mode === 'add' ? <Check label="이어 찍기 (직전에 고른 지점과 간선으로 잇기)" checked={chain} onToggle={props.onToggleChain} /> : null}
      {mode === 'link' && pending ? <Text style={styles.pending}>{`${shortId(pending)} 에서 시작 — 이을 지점을 누르세요`}</Text> : null}

      <Section title={selectedNode ? `선택 지점: ${shortId(selectedNode.id)}` : '선택한 지점 없음'}>
        {selectedNode ? (
          <>
            <Text style={ui.sectionHelp}>{`${selectedNode.id} · ${selectedNode.lat.toFixed(7)}, ${selectedNode.lng.toFixed(7)}${
              selectedNode.ref ? ` · 기존 지점 ${selectedNode.ref} 복사본(v1 변환)` : ''
            }`}</Text>
            <TextInput
              key={selectedNode.id}
              defaultValue={selectedNode.memo ?? ''}
              onChangeText={(text) => props.onNodeMemo(selectedNode.id, text)}
              placeholder="메모 (예: 계단 5칸, 휠체어 불가, 공사 중)"
              multiline
              style={ui.memoInput}
            />
            {selectedNode.sharedId ? <Text style={ui.hint}>공유 특수 지점이에요. 위치 변경은 모든 참조 모듈에 반영되고, 아래 삭제는 이 모듈의 참조와 연결만 제거해요. 공유를 시작한 지점의 성질은 고정돼요.</Text> : null}
            <Text style={ui.sectionHelp}>지점 성질</Text>
            {selectedNode.sharedId ? (
              <Text style={ui.sectionHelp}>{NODE_KIND_INFO[selectedNode.kind!].label}</Text>
            ) : (
              (Object.keys(NODE_KIND_INFO) as SurveyNodeKind[]).map((kind) => (
                <Check
                  key={kind}
                  label={NODE_KIND_INFO[kind].label}
                  checked={selectedNode.kind === kind}
                  onToggle={() => props.onNodeKind(selectedNode.id, selectedNode.kind === kind ? undefined : kind)}
                  color={NODE_KIND_INFO[kind].color}
                />
              ))
            )}
            <Btn label={selectedNode.sharedId ? '이 모듈의 참조와 연결 간선 지우기' : '이 지점과 연결 간선 지우기'} kind="danger" onPress={props.onDeleteSelected} />
          </>
        ) : (
          <Text style={ui.empty}>편집 중인 모듈의 점을 누르면 메모를 달 수 있어요</Text>
        )}
      </Section>
      <Row>
        <Btn label="되돌리기" onPress={props.onUndo} />
        {active ? <Btn label="모듈 마치기" onPress={() => props.onFinish(active.id)} /> : null}
        <Btn label="새 모듈 시작" onPress={props.onStart} />
      </Row>
      {active ? (
        <EdgePanel
          module={active}
          selectedEdge={props.selectedEdge}
          onSelect={props.onSelectEdge}
          onMemo={props.onEdgeMemo}
          onKind={props.onEdgeKind}
          onDelete={props.onDeleteEdge}
        />
      ) : null}
      <Legend color={active?.color} />
    </>
  )
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: 6 },
  pending: { fontFamily: FONTS.semibold, fontSize: 12.5, color: '#EA580C' },
})
