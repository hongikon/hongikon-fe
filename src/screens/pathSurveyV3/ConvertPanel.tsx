import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { pickTextFile } from '../../utils/pathSurveySync'
import { shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
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
import { Btn, Check, Row, Section, ui } from '../pathSurvey/ui'
import { Chip, Collapsible } from './controls'

const KIND_TITLE: Record<ManualKind, string> = {
  entrance: '출입구 확인',
  elevator: '엘리베이터 확인',
  boundary: '건물 경계 안의 외부 점',
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
  multi,
  selected,
  onConvert,
  onFocus,
  onNotice,
  onToggleMulti,
  onSelectMany,
  onKeepOutdoor,
  onResetKept,
  onMakeIndoor,
}: {
  store: StoreV3
  index: BuildingIndex
  report: ConvertReport | null
  multi: readonly string[]
  selected: string | null
  onConvert: (source: V2Source) => void
  onFocus: (nodeId: string) => void
  onNotice: (message: string) => void
  onToggleMulti: (nodeId: string) => void
  onSelectMany: (ids: string[]) => void
  onKeepOutdoor: (ids: string[]) => void
  onResetKept: () => void
  onMakeIndoor: (ids: string[]) => void
}) {
  const [text, setText] = useState('')
  const hasLocal = useMemo(() => !!readV2FromStorage(), [])
  const nodeById = useMemo(() => new Map(store.nodes.map((n) => [n.id, n])), [store.nodes])
  const dismissed = report?.dismissed ?? []

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

  const candidateText = (item: ManualItem) => item.candidates.map((c) => `${index.byCode.get(c.building)?.name ?? c.building}${floorText(c.floors)}`).join(', ')

  const manual = report?.manual ?? []
  const open = manual.filter((item) => isManualItemOpen(item, nodeById.get(item.nodeId), dismissed))
  const openBoundary = open.filter((item) => item.kind === 'boundary').map((item) => item.nodeId)
  const pickedBoundary = openBoundary.filter((id) => multi.includes(id))
  // Floors differ per building, so the usual bulk step is one building at a time.
  const boundaryByBuilding = new Map<string, string[]>()
  for (const item of open) {
    const code = item.kind === 'boundary' ? item.candidates[0]?.building : undefined
    if (code) boundaryByBuilding.set(code, [...(boundaryByBuilding.get(code) ?? []), item.nodeId])
  }

  const rowBody = (item: ManualItem) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={ui.rowText}>{`${item.nodeId}${item.source ? ` ${item.source}` : ''}`}</Text>
      <Text style={ui.hint}>{item.reason}</Text>
      {item.candidates.length ? <Text style={ui.hint}>{`후보: ${candidateText(item)}`}</Text> : null}
    </View>
  )

  return (
    <View style={{ gap: 14 }}>
      {report ? (
        <Section
          title={`수동 확인 목록: 남은 ${open.length} / 전체 ${manual.length}`}
          help="누르면 지도가 그 점으로 이동하고 위에 시트가 열려요. 채우면 목록에서 빠져요."
        >
          {open.length === 0 ? <Text style={ui.empty}>{'모두 처리했어요.'}</Text> : null}
          {(['entrance', 'elevator'] as ManualKind[]).map((kind) => {
            const items = open.filter((item) => item.kind === kind)
            if (!items.length) return null
            return (
              <View key={kind} style={styles.block}>
                <Text style={ui.sectionHelp}>{`${KIND_TITLE[kind]} ${items.length}`}</Text>
                {items.map((item) => (
                  <Pressable
                    key={`${item.kind}:${item.nodeId}`}
                    onPress={() => onFocus(item.nodeId)}
                    style={[ui.listRow, styles.row, selected === item.nodeId && ui.listRowOn]}
                    accessibilityRole="button"
                  >
                    {rowBody(item)}
                  </Pressable>
                ))}
              </View>
            )
          })}
          {openBoundary.length ? (
            <View style={styles.block}>
              <Text style={ui.sectionHelp}>{`${KIND_TITLE.boundary} ${openBoundary.length}`}</Text>
              <View style={styles.chips}>
                {[...boundaryByBuilding].map(([code, ids]) => (
                  <Chip key={code} label={`${shortBuildingName(index.byCode.get(code), code)} ${ids.length}`} onPress={() => onSelectMany(ids)} />
                ))}
              </View>
              <Row>
                <Btn label="모두 선택" onPress={() => onSelectMany(openBoundary)} />
                <Btn label="선택 비우기" disabled={pickedBoundary.length === 0} onPress={() => onSelectMany([])} />
              </Row>
              <Row>
                <Btn label={`선택 ${pickedBoundary.length}개 외부 유지`} disabled={pickedBoundary.length === 0} onPress={() => onKeepOutdoor(pickedBoundary)} />
                <Btn label={`선택 ${pickedBoundary.length}개 내부로 변경`} disabled={pickedBoundary.length === 0} onPress={() => onMakeIndoor(pickedBoundary)} />
              </Row>
              {open
                .filter((item) => item.kind === 'boundary')
                .map((item) => (
                  <View key={item.nodeId} style={[styles.boundary, selected === item.nodeId && ui.listRowOn]}>
                    <View style={styles.boundaryHead}>
                      <Check label="" checked={multi.includes(item.nodeId)} onToggle={() => onToggleMulti(item.nodeId)} color="#7C3AED" />
                      <Pressable onPress={() => onFocus(item.nodeId)} style={styles.boundaryBody} accessibilityRole="button">
                        {rowBody(item)}
                      </Pressable>
                    </View>
                    <Row>
                      <Btn label="외부 유지" onPress={() => onKeepOutdoor([item.nodeId])} />
                      <Btn label="내부로 변경" onPress={() => onMakeIndoor([item.nodeId])} />
                    </Row>
                  </View>
                ))}
            </View>
          ) : null}
          {dismissed.length ? <Btn label={`외부 유지 ${dismissed.length}건 다시 확인하기`} onPress={onResetKept} /> : null}
        </Section>
      ) : null}

      <Collapsible title="v2 데이터 가져오기" initialOpen={!report}>
        <Text style={ui.hint}>{'v2 원본은 읽기만 해서 바뀌지 않아요. 여러 번 다시 가져와도 돼요. 지금 v3 데이터가 있으면 확인을 받고 저장 지점을 먼저 만들어요.'}</Text>
        <Row>
          <Btn label={hasLocal ? '이 브라우저의 v2 읽기' : '이 브라우저에 v2 없음'} onPress={fromLocal} disabled={!hasLocal} />
          <Btn label="v2 파일 고르기" onPress={fromFile} />
        </Row>
        <TextInput value={text} onChangeText={setText} placeholder="내보낸 v2 JSON 붙여 넣기" multiline autoCapitalize="none" autoCorrect={false} style={ui.memoInput} />
        <Btn label="붙여 넣은 내용 변환" onPress={() => fromText(text)} disabled={!text.trim()} />
      </Collapsible>

      {report ? (
        <Collapsible title="변환 결과">
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
        </Collapsible>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { paddingVertical: 8 },
  boundary: { gap: 6, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  boundaryHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  boundaryBody: { flex: 1, minHeight: 44, justifyContent: 'center' },
})
