import { useState } from 'react'
import type { GistMeta, GistSettings } from '../../utils/pathSurvey/sync'

/** GistPanel 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useGistPanel({ settings }: Pick<{
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
}, 'settings'>) {
  const [token, setToken] = useState(settings.token)
  const [gistId, setGistId] = useState(settings.gistId)
  const changed = token.trim() !== settings.token || gistId.trim() !== settings.gistId
  const configured = !!settings.token
  return { token, setToken, gistId, setGistId, changed, configured }
}
