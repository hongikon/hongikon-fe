import { useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { pickTextFile } from '../../utils/pathSurveySync'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import {
  isManualItemOpen,
  parseV2Text,
  readV2FromStorage,
  type ConvertReport,
  type ManualItem,
  type ManualKind,
  type V2Source,
} from '../../utils/pathSurveyV3/convertV2'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { Btn, Row, Section, ui } from '../pathSurvey/ui'

const KIND_TITLE: Record<ManualKind, string> = {
  entrance: '출입구 확인',
  elevator: '엘리베이터 확인',
  boundary: '건물 경계 안의 외부 점(참고)',
}

function floorText(floors: number[] | undefined): string {
  if (!floors?.length) return ''
  return floors.length === 1 ? ` ${floors[0]}층` : ` ${floors[0]}~${floors[floors.length - 1]}층`
}

/** v2 import and the list of points a person has to look at. The v2 data is only read. */
export default function ConvertPanel({
  store,
  index,
  report,
  onConvert,
  onFocus,
  onNotice,
}: {
  store: StoreV3
  index: BuildingIndex
  report: ConvertReport | null
  onConvert: (source: V2Source) => void
  onFocus: (nodeId: string) => void
  onNotice: (message: string) => void
}) {
  const [text, setText] = useState('')
  const hasLocal = useMemo(() => !!readV2FromStorage(), [])
  const nodeById = useMemo(() => new Map(store.nodes.map((n) => [n.id, n])), [store.nodes])

  const fromText = (value: string) => {
    try {
      onConvert(parseV2Text(value))
      setText('')
    } catch (e) {
      onNotice(`변환하지 못했어요. ${(e as Error).message}`)
    }
  }

  const fromLocal = () => {
    const source = readV2FromStorage()
    if (source) onConvert(source)
    else onNotice('이 브라우저에 읽을 수 있는 v2 조사 내용이 없어요.')
  }

  const fromFile = async () => {
    const value = await pickTextFile()
    if (value) fromText(value)
  }

  const candidateText = (item: ManualItem) =>
    item.candidates
      .map((c) => `${index.byCode.get(c.building)?.name ?? c.building}${floorText(c.floors)}`)
      .join(', ')

  const open = (report?.manual ?? []).filter((item) => isManualItemOpen(item, nodeById.get(item.nodeId)))

  return (
    <View style={{ gap: 14 }}>
      <Section title="v2 데이터 가져오기" help="v2 원본은 읽기만 해서 바뀌지 않아요. 여러 번 다시 가져와도 돼요. 지금 v3 데이터가 있으면 확인을 받고 저장 지점을 먼저 만들어요.">
        <Row>
          <Btn label={hasLocal ? '이 브라우저의 v2 읽기' : '이 브라우저에 v2 없음'} onPress={fromLocal} disabled={!hasLocal} />
          <Btn label="v2 파일 고르기" onPress={fromFile} />
        </Row>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="내보낸 v2 JSON 붙여 넣기"
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={ui.memoInput}
        />
        <Btn label="붙여 넣은 내용 변환" onPress={() => fromText(text)} disabled={!text.trim()} />
      </Section>

      {report ? (
        <Section title="변환 결과">
          <Text style={ui.hint}>{`지점 ${report.rawNodes} > ${report.mergedNodes} (합쳐진 ${report.rawNodes - report.mergedNodes})`}</Text>
          <Text style={ui.hint}>{`간선 ${report.rawEdges} > ${report.mergedEdges} (계단 ${report.stairsEdges})`}</Text>
          <Text style={ui.hint}>
            {`옛 종류: 기본 ${report.oldKinds.basic}, 교차점 ${report.oldKinds.intersection}, 출입구 ${report.oldKinds.entrance}, 엘리베이터 ${report.oldKinds.elevator}, 계단 끝 ${report.oldKinds.stairs}`}
          </Text>
          <Text style={ui.hint}>{`출입구 자동 ${report.autoEntrances}, 수동 ${report.manualEntrances} / 엘리베이터 자동 ${report.autoElevators}, 수동 ${report.manualElevators}`}</Text>
          <Text style={ui.hint}>{`연결 덩어리 ${report.components} (가장 큰 것 ${report.largestComponent}), 고립 ${report.isolated}`}</Text>
          <Text style={ui.hint}>{`두 건물을 직접 이은 출입구 쌍 ${report.crossBuildingPairs} (= 표기 ${report.bridgePairs})`}</Text>
          <Text style={ui.hint}>{`건물 경계 안의 외부 점 ${report.boundaryCandidates}`}</Text>
          {report.labelsNotOnServer.length ? <Text style={ui.hint}>{`서버에 없는 라벨 ${report.labelsNotOnServer.length}: ${report.labelsNotOnServer.join(', ')}`}</Text> : null}
        </Section>
      ) : null}

      {report ? (
        <Section title={`수동 확인 목록 (남은 ${open.length})`} help="누르면 그 점으로 이동해요. 채우는 시트는 다음 단계에서 붙어요.">
          {(['entrance', 'elevator', 'boundary'] as ManualKind[]).map((kind) => {
            const items = open.filter((item) => item.kind === kind)
            if (!items.length) return null
            return (
              <View key={kind} style={{ gap: 6 }}>
                <Text style={ui.sectionHelp}>{`${KIND_TITLE[kind]} ${items.length}`}</Text>
                {items.map((item) => (
                  <Pressable key={`${item.kind}:${item.nodeId}`} onPress={() => onFocus(item.nodeId)} style={[ui.listRow, { paddingVertical: 8 }]} accessibilityRole="button">
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={ui.rowText}>{`${item.nodeId}${item.source ? ` ${item.source}` : ''}`}</Text>
                      <Text style={ui.hint}>{item.reason}</Text>
                      {item.candidates.length ? <Text style={ui.hint}>{`후보: ${candidateText(item)}`}</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            )
          })}
        </Section>
      ) : null}
    </View>
  )
}
