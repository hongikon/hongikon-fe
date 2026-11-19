import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { confirmAction } from '../../screens/pathSurvey/ui'
import { findModule, type SurveyStore } from '../../utils/pathSurveyStore'
import {
  applyImport,
  describePlan,
  dropLocallyDeleted,
  fetchGistBundle,
  hasUnsyncedChanges,
  loadGistMeta,
  loadGistSettings,
  metaAfterSync,
  parseBundle,
  planImport,
  pushConflicts,
  pushGistBundle,
  saveGistMeta,
  saveGistSettings,
  type GistMeta,
  type GistSettings,
  type ImportPlan,
} from '../../utils/pathSurveySync'

interface SyncOptions {
  store: SurveyStore
  storeRef: MutableRefObject<SurveyStore>
  commit: (next: SurveyStore, record?: boolean) => void
  clearSelection: () => void
  setNotice: (text: string) => void
}

/**
 * 가져오기와 Gist 동기화("내보내기"·"동기화" 탭). 같은 모듈이 더 최신이면 덮어쓰기 전에 묻고, 실패해도 이 기기의
 * 조사 내용(localStorage)은 그대로 둔다. 오프라인이면 변경 표시만 남기고, 다시 온라인이 되면 안내한다.
 */
export function useGistSync({ store, storeRef, commit, clearSelection, setNotice }: SyncOptions) {
  const [gistSettings, setGistSettings] = useState<GistSettings>(() => loadGistSettings())
  const [gistMeta, setGistMeta] = useState<GistMeta>(() => loadGistMeta())
  const [online, setOnline] = useState(() => (globalThis as any).navigator?.onLine !== false)
  const [gistBusy, setGistBusy] = useState(false)
  const [gistStatus, setGistStatus] = useState('')
  const [gistError, setGistError] = useState('')

  /** 계획을 적용한다. 같은 id 가 더 최신이면 덮어쓰기 전에 묻는다(취소하면 새 모듈만). 적용한 저장소를 돌려준다. */
  const applyPlan = (plan: ImportPlan, extra = ''): SurveyStore | null => {
    if (plan.added.length === 0 && plan.newer.length === 0) {
      setNotice(`가져올 새 내용이 없어요 · ${describePlan(plan)}${extra}`)
      return null
    }
    const overwrite =
      plan.newer.length > 0 &&
      confirmAction(`${describePlan(plan)}${extra}\n\n더 최신인 모듈로 이 기기의 같은 모듈을 덮어쓸까요? 취소하면 새 모듈만 추가해요.`)
    const next = applyImport(storeRef.current, plan, overwrite)
    if (!findModule(next, next.activeModuleId)) clearSelection()
    commit(next)
    setNotice(`가져왔어요 · 새 모듈 ${plan.added.length}${plan.newer.length ? ` · 덮어쓴 모듈 ${overwrite ? plan.newer.length : 0}` : ''}${extra}`)
    return next
  }

  /** 내보낸 JSON 가져오기. */
  const runImport = (text: string) => {
    let incoming
    try {
      incoming = parseBundle(text)
    } catch (e) {
      return setNotice(`가져오지 못했어요 · ${(e as Error).message}`)
    }
    applyPlan(planImport(storeRef.current, incoming))
  }

  const saveSettings = (next: GistSettings) => {
    saveGistSettings(next)
    setGistSettings(next)
    setGistError('')
    setGistStatus(next.token ? '설정을 이 기기에 저장했어요' : '이 기기에서 토큰과 gist id 를 지웠어요')
  }

  /**
   * Gist 로 올리기. 먼저 원격을 읽어 모듈별 updatedAt 을 비교하고, 원격이 더 최신이거나 다른 기기에서 만든 모듈이 있으면
   * 덮어쓰기 전에 확인한다. 실패하면 사유만 보여 주고 이 기기의 조사 내용(localStorage)은 그대로 둔다.
   */
  const pushGist = async () => {
    if (!online) return setGistError('오프라인이에요. 변경은 이 기기에 저장돼 있으니 온라인이 되면 다시 눌러 주세요.')
    setGistBusy(true)
    setGistError('')
    setGistStatus('')
    try {
      const local = storeRef.current
      if (gistSettings.gistId) {
        const remote = await fetchGistBundle(gistSettings)
        const c = pushConflicts(local, remote?.modules ?? [], gistMeta)
        if (c.remoteNewer.length || c.remoteOnly.length) {
          const lines = [
            ...(c.remoteNewer.length ? [`Gist 쪽이 더 최신인 모듈 ${c.remoteNewer.length}: ${c.remoteNewer.map((m) => m.name).join(', ')}`] : []),
            ...(c.remoteOnly.length ? [`Gist 에만 있는 모듈 ${c.remoteOnly.length}: ${c.remoteOnly.map((m) => m.name).join(', ')}`] : []),
          ]
          if (!confirmAction(`${lines.join('\n')}\n\n올리면 Gist 의 이 내용이 이 기기 것으로 바뀌어 사라져요. 먼저 "불러오기"를 권해요. 그래도 올릴까요?`)) {
            setGistStatus('올리기를 멈췄어요. 불러오기로 먼저 합쳐 주세요.')
            return
          }
        }
      }
      const id = await pushGistBundle(gistSettings, local)
      if (id !== gistSettings.gistId) {
        const next = { ...gistSettings, gistId: id }
        saveGistSettings(next)
        setGistSettings(next)
      }
      const meta = metaAfterSync(local)
      saveGistMeta(meta)
      setGistMeta(meta)
      setGistStatus(`올렸어요 · 모듈 ${local.modules.length}${id !== gistSettings.gistId ? ' · 비공개 Gist 를 새로 만들었어요' : ''}`)
    } catch (e) {
      setGistError(`올리지 못했어요 · ${(e as Error).message}`)
    } finally {
      setGistBusy(false)
    }
  }

  /** Gist 에서 불러와 합치기. 마지막 동기화 뒤 이 기기에서 지운 모듈은 되살리지 않는다. */
  const pullGist = async () => {
    if (!online) return setGistError('오프라인이에요. 온라인이 되면 다시 눌러 주세요.')
    setGistBusy(true)
    setGistError('')
    setGistStatus('')
    try {
      const remote = await fetchGistBundle(gistSettings)
      if (!remote) return setGistStatus('Gist 에 아직 조사 파일이 없어요. 먼저 올려 주세요.')
      const { plan, skipped } = dropLocallyDeleted(planImport(storeRef.current, remote), gistMeta)
      const extra = skipped.length ? ` · 이 기기에서 지운 모듈 ${skipped.length}개는 되살리지 않았어요` : ''
      const next = applyPlan(plan, extra) ?? storeRef.current
      const remoteById = new Map(remote.modules.map((m) => [m.id, m]))
      const localAhead = next.modules.some((m) => (remoteById.get(m.id)?.updatedAt ?? -1) < m.updatedAt)
      const meta = { ...metaAfterSync(next, remote.modules), syncedStoreUpdatedAt: localAhead ? gistMeta.syncedStoreUpdatedAt : next.updatedAt }
      saveGistMeta(meta)
      setGistMeta(meta)
      setGistStatus(`불러왔어요 · Gist 모듈 ${remote.modules.length}${localAhead ? ' · 이 기기에 더 최신인 모듈이 있어 올리기가 필요해요' : ''}`)
    } catch (e) {
      setGistError(`불러오지 못했어요 · ${(e as Error).message}`)
    } finally {
      setGistBusy(false)
    }
  }

  const dirty = hasUnsyncedChanges(store, gistMeta)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  // 오프라인이면 변경 표시만 남기고, 온라인으로 돌아오면 올리지 않은 변경이 있을 때 안내한다.
  useEffect(() => {
    const w = globalThis as any
    if (typeof w.addEventListener !== 'function') return
    const on = () => {
      setOnline(true)
      if (dirtyRef.current && loadGistSettings().token) setNotice('다시 온라인이에요. 올리지 않은 변경이 있어요 — "동기화" 탭에서 올리기를 눌러 주세요.')
    }
    const off = () => setOnline(false)
    w.addEventListener('online', on)
    w.addEventListener('offline', off)
    return () => {
      w.removeEventListener('online', on)
      w.removeEventListener('offline', off)
    }
    // setNotice is a state setter of the screen: stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { gistSettings, gistMeta, online, dirty, gistBusy, gistStatus, gistError, saveSettings, pushGist, pullGist, runImport }
}
