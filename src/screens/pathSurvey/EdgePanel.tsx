import { Pressable, Text, TextInput, View } from 'react-native'
import { STAIRS_COLOR, type SurveyEdgeKind, type SurveyModule } from '../../utils/pathSurveyStore'
import { Btn, Section, shortId, ui } from './ui'

/**
 * 편집 중인 모듈의 간선 메모와 종류(일반 / 계단). 지도에서 간선을 누르거나(선 둘레를 넓게 잡아 폰에서도 누르기 쉽다) 아래 목록에서 고른다.
 */
export default function EdgePanel({
  module,
  selectedEdge,
  onSelect,
  onMemo,
  onKind,
  onDelete,
}: {
  module: SurveyModule
  selectedEdge: string | null
  onSelect: (id: string | null) => void
  onMemo: (id: string, memo: string) => void
  onKind: (id: string, kind: SurveyEdgeKind | undefined) => void
  onDelete: (id: string) => void
}) {
  const edge = selectedEdge ? module.edges.find((e) => e.id === selectedEdge) : undefined
  const stairs = edge?.kind === 'stairs'
  return (
    <>
      {edge ? (
        <Section title={`선택 간선: ${shortId(edge.a)} - ${shortId(edge.b)} (${stairs ? '계단' : '일반'})`} help={edge.id}>
          <Btn
            label={stairs ? '일반 간선으로 바꾸기' : '계단으로 바꾸기'}
            kind={stairs ? 'default' : 'primary'}
            onPress={() => onKind(edge.id, stairs ? undefined : 'stairs')}
            style={{ minHeight: 52 }}
          />
          <TextInput
            key={edge.id}
            defaultValue={edge.memo ?? ''}
            onChangeText={(text) => onMemo(edge.id, text)}
            placeholder="간선 메모 (예: 경사로, 비 오면 미끄러움, 밤에 닫힘)"
            multiline
            style={ui.memoInput}
          />
          <View style={ui.btnRow}>
            <Btn label="선택 해제" onPress={() => onSelect(null)} />
            <Btn label="이 간선 지우기" kind="danger" onPress={() => onDelete(edge.id)} />
          </View>
        </Section>
      ) : null}
      <Section title={`간선 ${module.edges.length}`} help="지도에서 선을 누르거나 아래에서 골라 메모를 달고, 계단이면 계단으로 바꿔요.">
        {module.edges.length === 0 ? <Text style={ui.empty}>아직 간선이 없어요</Text> : null}
        {module.edges.map((e) => {
          const on = e.id === selectedEdge
          return (
            <Pressable key={e.id} onPress={() => onSelect(on ? null : e.id)} style={[ui.listRow, on && ui.listRowOn]} accessibilityRole="button">
              <View style={[ui.swatch, { backgroundColor: e.kind === 'stairs' ? STAIRS_COLOR : module.color }]} />
              <Text style={ui.rowText} numberOfLines={1}>
                {`${e.kind === 'stairs' ? '[계단] ' : ''}${shortId(e.a)} - ${shortId(e.b)}${e.memo ? `, ${e.memo.replace(/\s+/g, ' ')}` : ''}`}
              </Text>
            </Pressable>
          )
        })}
      </Section>
    </>
  )
}
