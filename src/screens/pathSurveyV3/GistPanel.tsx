import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { afterSync, fetchGistSurvey, GIST_FILE_V3, GistErrorV3, loadGistState, pushGistSurvey, remoteHasOtherChanges, saveGistState, type GistStateV3 } from '../../utils/pathSurveyV3/gist'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { storeFingerprint } from '../../utils/pathSurveyV3/transfer'
import { Btn, confirmAction, Row, Section, ui } from '../pathSurvey/ui'
import { clockText } from './SaveBar'

/** Only our own error text reaches the screen, so nothing else can carry the token there. */
const failureText = (e: unknown) => (e instanceof GistErrorV3 ? e.message : '알 수 없는 오류로 동기화하지 못했어요.')

/**
 * Whole survey up and down. The token field is write only: a saved token is never put back in an input,
 * and the screen only says whether one is saved.
 */
export default function GistPanel({
  store,
  onPulled,
  onPushed,
  onNotice,
}: {
  store: StoreV3
  /** Replaces the data after asking. false when the person said no. */
  onPulled: (next: StoreV3) => boolean
  onPushed: () => void
  onNotice: (message: string) => void
}) {
  const [state, setState] = useState<GistStateV3>(() => loadGistState())
  const [tokenText, setTokenText] = useState('')
  const [idText, setIdText] = useState(state.gistId)
  const [busy, setBusy] = useState(false)
  const fingerprint = storeFingerprint(store)
  const hasToken = !!state.token

  const update = (next: GistStateV3) => {
    setState(next)
    saveGistState(next)
  }

  const settings = () => ({ token: state.token, gistId: idText.trim() })

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } catch (e) {
      onNotice(`동기화하지 못했어요. ${failureText(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const push = () =>
    run(async () => {
      const s = settings()
      const sent = fingerprint
      const remote = s.gistId ? await fetchGistSurvey(s) : null
      if (remoteHasOtherChanges(state, remote, sent) && !confirmAction(`Gist 에 이 브라우저가 모르는 내용이 있어요(지점 ${remote?.store.nodes.length}, 간선 ${remote?.store.edges.length}). 덮어쓸까요?`)) {
        onNotice('올리지 않았어요.')
        return
      }
      const now = Date.now()
      const id = await pushGistSurvey(s, store, undefined, now)
      setIdText(id)
      update(afterSync(state, id, sent, now, now))
      onPushed()
      onNotice('Gist 에 올렸어요.')
    })

  const pull = () =>
    run(async () => {
      const s = settings()
      const remote = await fetchGistSurvey(s)
      if (!remote) return onNotice('이 Gist 에 v3 조사 파일이 아직 없어요.')
      if (!onPulled(remote.store)) return
      update(afterSync(state, s.gistId, remote.fingerprint, remote.exportedAt))
    })

  const status = state.lastSyncAt
    ? `마지막 동기화 ${clockText(state.lastSyncAt)}${state.lastSyncFingerprint === fingerprint ? '' : ', 올리지 않은 변경이 있어요'}`
    : '아직 동기화한 적 없어요'

  return (
    <Section title="Gist 동기화" help={`조사 전체를 비공개 Gist 의 ${GIST_FILE_V3} 파일 하나로 올리고 받아요. 토큰은 이 브라우저에만 저장돼요.`}>
      <Text style={ui.hint}>{status}</Text>
      {hasToken ? (
        <Row>
          <Text style={[ui.hint, { flex: 1, alignSelf: 'center' }]}>{'토큰 저장됨'}</Text>
          <Btn
            label="토큰 지우기"
            onPress={() => {
              update({ ...state, token: '' })
              onNotice('토큰을 지웠어요.')
            }}
          />
        </Row>
      ) : (
        <View style={{ gap: 6 }}>
          <TextInput
            value={tokenText}
            onChangeText={setTokenText}
            placeholder="GitHub 토큰 (gist 권한)"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            style={ui.input}
            accessibilityLabel="GitHub 토큰"
          />
          <Btn
            label="토큰 저장"
            disabled={!tokenText.trim()}
            onPress={() => {
              update({ ...state, token: tokenText.trim() })
              setTokenText('')
              onNotice('토큰을 저장했어요.')
            }}
          />
        </View>
      )}
      <TextInput
        value={idText}
        onChangeText={setIdText}
        onBlur={() => {
          if (idText.trim() !== state.gistId) update({ ...state, gistId: idText.trim() })
        }}
        placeholder="gist id (비우고 올리면 새로 만들어요)"
        autoCapitalize="none"
        autoCorrect={false}
        style={ui.input}
        accessibilityLabel="gist id"
      />
      <Row>
        <Btn label={busy ? '처리 중' : 'Gist 에 올리기'} disabled={busy || !hasToken} onPress={push} />
        <Btn label={busy ? '처리 중' : 'Gist 에서 불러오기'} disabled={busy || !idText.trim()} onPress={pull} />
      </Row>
    </Section>
  )
}
