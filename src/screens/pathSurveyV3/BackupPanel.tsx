import { useMemo, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { copyText, downloadText, pickTextFile } from '../../utils/pathSurveySync'
import { floorChipLabel, shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { backupFileName, buildGraphExport, graphFileName, labelsNotOnServer, parseBackupText, serializeBackup, type BackupVia } from '../../utils/pathSurveyV3/transfer'
import { Btn, Row, Section, ui } from '../pathSurvey/ui'
import GistPanel from './GistPanel'

/** Backups work at any time. The expanded graph for routing work needs zero check errors. */
export default function BackupPanel({
  store,
  index,
  errorCount,
  backupStatus,
  onBackedUp,
  onRestore,
  onPulled,
  onNotice,
}: {
  store: StoreV3
  index: BuildingIndex
  errorCount: number
  backupStatus: string
  onBackedUp: (via: BackupVia) => void
  onRestore: (next: StoreV3) => void
  onPulled: (next: StoreV3) => boolean
  onNotice: (message: string) => void
}) {
  const [text, setText] = useState('')
  const [manualCopy, setManualCopy] = useState<string | null>(null)
  const exported = useMemo(() => (errorCount === 0 ? buildGraphExport(store, index) : null), [store, index, errorCount])
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
      <Section title="백업" help="오류가 있어도 언제든 할 수 있어요.">
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
      <Section title="경로망 내보내기" help="길찾기 작업에 쓰는 펼친 그래프 파일이에요.">
        <Btn
          label="경로망 내보내기"
          disabled={!exported}
          onPress={() => {
            if (!exported) return
            if (downloadText(graphFileName(), exported.text)) onNotice('경로망 파일을 내려받았어요.')
            else onNotice('이 브라우저에서는 파일을 내려받지 못해요.')
          }}
        />
        {errorCount > 0 ? <Text style={ui.error}>{`오류 ${errorCount}건이 남아 있어 내보낼 수 없어요. 점검 탭에서 고쳐 주세요.`}</Text> : null}
        {exported ? (
          <>
            <Text style={ui.hint}>{`지점 ${exported.summary.nodes}, 간선 ${exported.summary.edges} > 그래프 점 ${exported.summary.vertices}, 그래프 간선 ${exported.summary.graphEdges}`}</Text>
            <Text style={ui.hint}>{`외부 점 ${exported.summary.outdoorVertices}`}</Text>
            <Text style={ui.hint}>
              {exported.summary.byLevel.map((l) => `${shortBuildingName(index.byCode.get(l.building), l.building)} ${floorChipLabel(l.floor)}층 ${l.count}`).join(', ')}
            </Text>
          </>
        ) : null}
        {missing.length ? <Text style={ui.hint}>{`서버에 없는 출입구 이름 ${missing.length}: ${missing.join(', ')}`}</Text> : null}
      </Section>
    </View>
  )
}
