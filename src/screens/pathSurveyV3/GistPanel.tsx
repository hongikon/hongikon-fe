import { Text, TextInput, View } from 'react-native'
import { GIST_FILE_V3 } from '../../utils/pathSurveyV3/gist'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { Btn, Row, Section, ui } from '../pathSurvey/ui'
import { useGistPanel } from '../../hooks/pathSurveyV3/useGistPanel'

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
  const { state, tokenText, setTokenText, idText, setIdText, busy, hasToken, update, push, pull, status } = useGistPanel({ store, onPulled, onPushed, onNotice })

  return (
    <Section title="Gist 동기화 (보험)" help={`서버 저장이 안 될 때 쓰는 예전 방법이에요. 조사 전체를 비공개 Gist 의 ${GIST_FILE_V3} 파일 하나로 올리고 받아요. 토큰은 이 브라우저에만 저장돼요.`}>
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
