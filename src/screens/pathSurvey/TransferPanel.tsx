import { useState } from 'react'
import { Share, Text, TextInput, View } from 'react-native'
import { formatModuleExport } from '../../utils/pathSurvey'
import { findModule, type SurveyStore } from '../../utils/pathSurveyStore'
import { copyText, downloadText, pickTextFile, serializeAll, serializeModule, stamp } from '../../utils/pathSurveySync'
import { Btn, Section, ui } from './ui'

/**
 * 내보내기/가져오기. 전체·모듈 단위 JSON(파일 저장 + 클립보드)과, 모듈 단위 pathNodes.ts 붙여넣기용 코드 조각.
 * 가져오기는 화면(onImport)이 계획을 세워 같은 id 가 더 최신이면 덮어쓰기 전에 확인한다.
 */
export default function TransferPanel({
  store,
  initialModuleId,
  onImport,
  onNotice,
}: {
  store: SurveyStore
  initialModuleId: string | null
  onImport: (text: string) => void
  onNotice: (text: string) => void
}) {
  const [moduleId, setModuleId] = useState(initialModuleId ?? store.modules[0]?.id ?? null)
  const [showCode, setShowCode] = useState(false)
  const [paste, setPaste] = useState('')
  const module = findModule(store, moduleId)
  const code = module && showCode ? formatModuleExport(module) : ''

  const copy = async (text: string, what: string) => {
    if (await copyText(text)) return onNotice(`${what} 복사했어요`)
    await Share.share({ message: text })
  }
  const save = (filename: string, text: string) => {
    if (!downloadText(filename, text)) onNotice('이 브라우저에서는 파일로 저장할 수 없어요. 복사를 써 주세요.')
  }
  const fileName = (name: string) => `path-survey-${name.replace(/[\\/:*?"<>|\s]+/g, '_')}-${stamp()}.json`

  return (
    <View style={{ gap: 16 }}>
      <Section title={`전체 (${store.modules.length}개 모듈)`} help="모든 모듈과 직접 추가한 색을 JSON 하나로 내보내요.">
        <View style={ui.btnRow}>
          <Btn label="전체 파일로 저장" onPress={() => save(fileName('all'), serializeAll(store))} />
          <Btn label="전체 복사" onPress={() => copy(serializeAll(store), '전체 JSON 을')} />
        </View>
      </Section>

      <Section title="모듈 하나" help="내보낼 모듈을 고르세요.">
        <View style={ui.btnRow}>
          {store.modules.map((m) => (
            <Btn
              key={m.id}
              label={m.name}
              kind={m.id === moduleId ? 'active' : 'default'}
              onPress={() => {
                setModuleId(m.id)
                setShowCode(false)
              }}
              style={{ flexGrow: 0 }}
            />
          ))}
        </View>
        {store.modules.length === 0 ? <Text style={ui.empty}>아직 모듈이 없어요</Text> : null}
        {module ? (
          <>
            <View style={ui.btnRow}>
              <Btn label="모듈 파일로 저장" onPress={() => save(fileName(module.name), serializeModule(module))} />
              <Btn label="모듈 JSON 복사" onPress={() => copy(serializeModule(module), `'${module.name}' JSON 을`)} />
            </View>
            <Btn label={showCode ? 'pathNodes.ts 코드 조각 닫기' : 'pathNodes.ts 코드 조각 보기'} onPress={() => setShowCode((v) => !v)} />
            {showCode ? (
              <>
                <Text style={ui.sectionHelp}>PATH_WAYPOINTS / PATH_EDGES 끝에 붙여 넣는 모양이에요. 지점 id 는 합칠 때 n번호로 바꿔야 해요.</Text>
                <TextInput value={code} multiline editable={false} selectTextOnFocus style={[ui.memoInput, { minHeight: 140, maxHeight: 260, fontSize: 11.5 }]} />
                <Btn label="코드 조각 복사" kind="primary" onPress={() => copy(code, '코드 조각을')} />
              </>
            ) : null}
          </>
        ) : null}
      </Section>

      <Section title="가져오기" help="내보낸 JSON(전체 또는 모듈)을 읽어요. 같은 모듈이 있으면 더 최신(updatedAt)인 쪽을 쓰고, 이 기기 것을 덮어쓰기 전에 물어봐요.">
        <Btn
          label="파일에서 가져오기"
          onPress={async () => {
            const text = await pickTextFile()
            if (text !== null) onImport(text)
          }}
        />
        <TextInput value={paste} onChangeText={setPaste} placeholder="여기에 JSON 붙여 넣기" multiline style={[ui.memoInput, { maxHeight: 160 }]} />
        <Btn
          label="붙여 넣은 JSON 가져오기"
          disabled={!paste.trim()}
          onPress={() => {
            onImport(paste)
            setPaste('')
          }}
        />
      </Section>
    </View>
  )
}
