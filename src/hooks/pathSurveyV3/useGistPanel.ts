import { useState } from 'react'
import { afterSync, fetchGistSurvey, loadGistState, pushGistSurvey, remoteHasOtherChanges, saveGistState, type GistStateV3 } from '../../utils/pathSurveyV3/gist'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { storeFingerprint } from '../../utils/pathSurveyV3/transfer'
import { confirmAction } from '../../utils/pathSurvey/ui'
import { clockText } from '../../utils/pathSurveyV3/saveBar'
import { failureText } from '../../utils/pathSurveyV3/gistPanel'

/** State, effects and handlers of GistPanel. The screen file only renders. */
export function useGistPanel({ store, onPulled, onPushed, onNotice }: Pick<{
  store: StoreV3
  /** Replaces the data after asking. false when the person said no. */
  onPulled: (next: StoreV3) => boolean
  onPushed: () => void
  onNotice: (message: string) => void
}, 'store' | 'onPulled' | 'onPushed' | 'onNotice'>) {
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
  return { state, tokenText, setTokenText, idText, setIdText, busy, hasToken, update, push, pull, status }
}
