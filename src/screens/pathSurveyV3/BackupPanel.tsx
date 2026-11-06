import { useDeferredValue, useMemo, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { copyText, downloadText, pickTextFile } from '../../utils/pathSurveySync'
import { floorChipLabel, shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { backupFileName, buildGraphExport, graphFileName, labelsNotOnServer, parseBackupText, serializeBackup, type BackupVia } from '../../utils/pathSurveyV3/transfer'
import { Btn, Row, Section, ui } from '../pathSurvey/ui'
import GistPanel from './GistPanel'

/** Two different files. A backup is the working copy to load again. The graph export is what routing work reads, finished or not. */
export default function BackupPanel({
  store,
  index,
  tolerance,
  backupStatus,
  onBackedUp,
  onRestore,
  onPulled,
  onNotice,
}: {
  store: StoreV3
  index: BuildingIndex
  tolerance: number
  backupStatus: string
  onBackedUp: (via: BackupVia) => void
  onRestore: (next: StoreV3) => void
  onPulled: (next: StoreV3) => boolean
  onNotice: (message: string) => void
}) {
  const [text, setText] = useState('')
  const [manualCopy, setManualCopy] = useState<string | null>(null)
  // The preview runs on a deferred copy. The file itself is made from the current data when the button is pressed.
  const deferred = useDeferredValue(store)
  const preview = useMemo(() => buildGraphExport(deferred, index, 0, { entranceToleranceM: tolerance }), [deferred, index, tolerance])
  const missing = useMemo(() => labelsNotOnServer(store, index), [store, index])

  const saveFile = () => {
    if (downloadText(backupFileName(), serializeBackup(store))) {
      onBackedUp('file')
      onNotice('백업 파일을 내려받았어요. 잘 보관해 주세요.')
    } else onNotice('이 브라우저에서는 파일을 내려받지 못해요. 코드 복사를 써 주세요.')
  }

  const copyAll = async () => {
    const value = serializeBackup(store)
    if (await copyText(value)) {
      setManualCopy(null)
      onBackedUp('copy')
      onNotice('백업 내용을 복사했어요. 메모 앱 같은 곳에 붙여 넣어 보관해 주세요.')
    } else {
      setManualCopy(value)
      onNotice('자동 복사가 막혀 있어요. 아래 칸의 내용을 직접 복사해 주세요.')
    }
  }

  const restore = (value: string) => {
    try {
      onRestore(parseBackupText(value))
      setText('')
    } catch (e) {
      onNotice(`불러오지 못했어요. ${(e as Error).message}`)
    }
  }

  const fromFile = async () => {
    const value = await pickTextFile()
    if (value) restore(value)
  }

  return (
    <View style={{ gap: 14 }}>
      <Text style={ui.warn}>{'브라우저 저장은 사이트 데이터를 지우면 사라져요. 백업 파일을 따로 보관해 주세요.'}</Text>
      <Section title="백업 (작업 원본)" help="다시 불러와 이어서 작업할 때 쓰는 파일이에요. 오류가 있어도 언제든 할 수 있어요. 네비게이션에 쓸 파일은 아래 경로망 내보내기예요.">
        <Text style={ui.hint}>{backupStatus}</Text>
        <Row>
          <Btn label="백업 저장" kind="primary" onPress={saveFile} />
          <Btn label="코드 복사" onPress={copyAll} />
        </Row>
        {manualCopy ? <TextInput value={manualCopy} multiline editable={false} selectTextOnFocus style={[ui.memoInput, { maxHeight: 160 }]} /> : null}
      </Section>
      <GistPanel store={store} onPulled={onPulled} onPushed={() => onBackedUp('gist')} onNotice={onNotice} />
      <Section title="불러오기" help="지금 데이터를 덮어써요. 확인을 받고 저장 지점을 먼저 남겨요.">
        <Btn label="파일 고르기" onPress={fromFile} />
        <TextInput value={text} onChangeText={setText} placeholder="백업 코드 붙여 넣기" multiline autoCapitalize="none" autoCorrect={false} style={ui.memoInput} />
        <Btn label="붙여 넣은 내용 불러오기" disabled={!text.trim()} onPress={() => restore(text)} />
      </Section>
      <Section title="경로망 내보내기 (네비게이션용)" help="가공 없이 네비게이션에 쓰는 펼친 그래프 파일이에요. 언제든 받을 수 있고, 오류가 있으면 미완성으로 표시돼요. 불러오기용 백업은 위의 백업을 쓰세요.">
        <Row>
          <Btn
            label="경로망 내보내기"
            onPress={() => {
              const now = Date.now()
              const made = buildGraphExport(store, index, now, { entranceToleranceM: tolerance })
              if (!downloadText(graphFileName(new Date(now), made.complete), made.text)) return onNotice('이 브라우저에서는 파일을 내려받지 못해요.')
              onNotice(made.complete ? '경로망 파일을 내려받았어요.' : `미완성 경로망 파일을 내려받았어요. 오류 ${made.errorCount}건, 그래프에서 뺀 점 ${made.excludedNodes}, 간선 ${made.excludedEdges}`)
            }}
          />
          {preview.complete ? <Text style={[ui.hint, styles.state]}>{'오류 없음(완성)'}</Text> : <Text style={[ui.error, styles.state]}>{`오류 ${preview.errorCount}건 포함(미완성)`}</Text>}
        </Row>
        <Text style={ui.hint}>{`지점 ${preview.summary.nodes}, 간선 ${preview.summary.edges} > 그래프 점 ${preview.summary.vertices}, 그래프 간선 ${preview.summary.graphEdges}`}</Text>
        {preview.excludedNodes || preview.excludedEdges ? <Text style={ui.warn}>{`오류 때문에 그래프에서 빠지는 것: 점 ${preview.excludedNodes}, 간선 ${preview.excludedEdges}. 파일의 excluded 에 사유와 함께 적혀요.`}</Text> : null}
        <Text style={ui.hint}>{`외부 점 ${preview.summary.outdoorVertices}`}</Text>
        <Text style={ui.hint}>
          {preview.summary.byLevel.map((l) => `${shortBuildingName(index.byCode.get(l.building), l.building)} ${floorChipLabel(l.floor)}층 ${l.count}`).join(', ')}
        </Text>
        {missing.length ? <Text style={ui.hint}>{`서버에 없는 출입구 이름 ${missing.length}: ${missing.join(', ')}`}</Text> : null}
      </Section>
    </View>
  )
}

const styles = StyleSheet.create({
  state: { flex: 1, alignSelf: 'center' },
})
