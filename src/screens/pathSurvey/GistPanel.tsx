import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import type { GistMeta, GistSettings } from '../../utils/pathSurveySync'
import { Btn, Section, ui } from './ui'

const timeText = (t: number | null) => {
  if (!t) return '아직 없음'
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Gist 동기화 설정·상태. 토큰과 gist id 는 이 기기 localStorage 에만 둔다(화면이 저장).
 * 올리기/불러오기 흐름(충돌 확인, 실패 처리)은 화면(DevPathSurveyScreen)이 맡는다.
 */
export default function GistPanel({
  settings,
  meta,
  online,
  dirty,
  busy,
  status,
  error,
  onSaveSettings,
  onPush,
  onPull,
}: {
  settings: GistSettings
  meta: GistMeta
  online: boolean
  dirty: boolean
  busy: boolean
  status: string
  error: string
  onSaveSettings: (next: GistSettings) => void
  onPush: () => void
  onPull: () => void
}) {
  const [token, setToken] = useState(settings.token)
  const [gistId, setGistId] = useState(settings.gistId)
  const changed = token.trim() !== settings.token || gistId.trim() !== settings.gistId
  const configured = !!settings.token

  return (
    <View style={{ gap: 16 }}>
      <Section title="Gist 동기화" help="조사자 1명이 기기 여러 대(폰·노트북)에서 같은 조사 내용을 이어 쓰기 위한 기능이에요. 모듈별 updatedAt 으로 어느 쪽이 최신인지 봐요.">
        <Text style={online ? ui.hint : ui.warn}>{online ? '온라인' : '오프라인 — 변경은 이 기기에 저장돼요. 온라인이 되면 올려 주세요.'}</Text>
        <Text style={dirty ? ui.warn : ui.hint}>{dirty ? '올리지 않은 변경이 있어요' : '마지막 동기화 이후 변경 없음'}</Text>
        <Text style={ui.hint}>{`마지막 동기화: ${timeText(meta.lastSyncAt)}`}</Text>
        {status ? <Text style={ui.hint}>{status}</Text> : null}
        {error ? <Text style={ui.error}>{error}</Text> : null}
        <View style={ui.btnRow}>
          <Btn label={busy ? '올리는 중...' : '올리기'} kind="primary" disabled={busy || !configured} onPress={onPush} />
          <Btn label={busy ? '받는 중...' : '불러오기'} disabled={busy || !configured || !settings.gistId} onPress={onPull} />
        </View>
      </Section>

      <Section
        title="설정 (이 기기에만 저장)"
        help="GitHub 토큰은 이 브라우저 localStorage 에만 저장되고 어디에도 올라가지 않아요. Gist 권한만 있는 토큰을 쓰세요. gist id 를 비워 두고 올리면 비공개 Gist 를 새로 만들고 id 를 채워 줘요."
      >
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder="GitHub 토큰 (gist 권한)"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          style={ui.input}
        />
        <TextInput value={gistId} onChangeText={setGistId} placeholder="gist id (비우면 새로 만듦)" autoCapitalize="none" autoCorrect={false} style={ui.input} />
        <View style={ui.btnRow}>
          <Btn label="설정 저장" disabled={!changed} onPress={() => onSaveSettings({ token: token.trim(), gistId: gistId.trim() })} />
          <Btn
            label="이 기기에서 지우기"
            kind="danger"
            disabled={!settings.token && !settings.gistId}
            onPress={() => {
              setToken('')
              setGistId('')
              onSaveSettings({ token: '', gistId: '' })
            }}
          />
        </View>
      </Section>
    </View>
  )
}
