import { useState, type MutableRefObject } from 'react'
import type { Tab } from '../../screens/pathSurvey/screenModel'
import { confirmAction } from '../../utils/pathSurvey/ui'
import { createModule, deleteModule, findModule, finishModule, reopenModule, updateModule, type SurveyStore } from '../../utils/pathSurvey/store'

interface ModuleOptions {
  storeRef: MutableRefObject<SurveyStore>
  commit: (next: SurveyStore, record?: boolean) => void
  /** 처음 펼쳐 둘 모듈(편집 중인 모듈, 없으면 첫 모듈). */
  initialDetailId: string | null
  clearSelection: () => void
  setTab: (tab: Tab) => void
  setNotice: (text: string) => void
}

/** "모듈" 탭: 모듈 시작·마치기·다시 편집·이름 바꾸기·지우기, 펼친 모듈(detailId), 지도에서 숨긴 모듈. */
export function useModuleActions({ storeRef, commit, initialDetailId, clearSelection, setTab, setNotice }: ModuleOptions) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [detailId, setDetailId] = useState<string | null>(initialDetailId)

  const startModule = () => {
    const { store: next, module } = createModule(storeRef.current)
    commit(next)
    clearSelection()
    setDetailId(module.id)
    setTab('edit')
    setNotice(`'${module.name}' 를 시작했어요. 지도를 눌러 지점을 찍으세요. 이름·장소는 "모듈" 탭에서 정해요.`)
  }

  /** 모듈 마치기: 이어 찍기를 끊고(선택 해제) done 으로. 장소가 없으면 바꾸지 않고 이유를 알린다. */
  const finish = (id: string) => {
    const { store: next, problems } = finishModule(storeRef.current, id)
    if (problems.length) {
      setDetailId(id)
      setTab('modules')
      return setNotice(`아직 마칠 수 없어요 · ${problems.join(' · ')}`)
    }
    commit(next)
    clearSelection()
    setNotice(`'${findModule(next, id)?.name}' 를 마쳤어요. 고치려면 "다시 편집"을 누르세요.`)
  }

  const reopen = (id: string) => {
    commit(reopenModule(storeRef.current, id))
    setHidden((h) => ({ ...h, [id]: false }))
    clearSelection()
    setDetailId(id)
    setNotice(`'${findModule(storeRef.current, id)?.name}' 를 편집해요`)
  }

  const rename = (id: string, name: string) => commit(updateModule(storeRef.current, id, (m) => ({ ...m, name })), false)

  const removeModule = (id: string) => {
    const m = findModule(storeRef.current, id)
    if (!m) return
    if (!confirmAction(`'${m.name}' 모듈을 지울까요? 지점 ${m.nodes.length} · 간선 ${m.edges.length} 이 함께 지워져요. (되돌리기로 살릴 수 있어요)`)) return
    const wasActive = id === storeRef.current.activeModuleId
    commit(deleteModule(storeRef.current, id))
    if (wasActive) clearSelection()
    setDetailId(storeRef.current.modules[0]?.id ?? null)
    setNotice(`'${m.name}' 를 지웠어요`)
  }

  const toggleHidden = (id: string) => setHidden((h) => ({ ...h, [id]: !h[id] }))

  return { hidden, toggleHidden, detailId, setDetailId, startModule, finish, reopen, rename, removeModule }
}
