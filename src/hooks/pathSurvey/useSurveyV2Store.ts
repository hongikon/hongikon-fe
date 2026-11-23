import { useCallback, useRef, useState } from 'react'
import { findModule, saveStore, updateModule, type LoadResult, type SurveyModule, type SurveyStore } from '../../utils/pathSurvey/store'

interface StoreOptions {
  /** 화면을 열 때 한 번 읽은 저장 내용(loadStore). 읽지 못했으면(corrupt) 이 탭은 저장하지 않는다. */
  boot: LoadResult
  setNotice: (text: string) => void
}

/**
 * v2 조사 저장소(모듈 묶음)와 되돌리기. 모든 변경은 commit 을 지나 localStorage(hongikon.pathSurvey.v2)에 바로 저장되고,
 * 되돌리기 기록은 50단계까지 남는다.
 */
export function useSurveyV2Store({ boot, setNotice }: StoreOptions) {
  const [store, setStore] = useState<SurveyStore>(boot.store)
  const storeRef = useRef(store)
  const historyRef = useRef<SurveyStore[]>([])
  /** v2 를 읽지 못했으면 이 탭에서는 저장하지 않는다(사람이 확인하기 전에 덮어쓰지 않게). */
  const saveBlocked = boot.corrupt

  /** 되돌리기 기록을 남기며 저장소를 바꾼다. */
  const commit = useCallback(
    (next: SurveyStore, record = true) => {
      if (next === storeRef.current) return
      if (record) historyRef.current = [...historyRef.current.slice(-49), storeRef.current]
      storeRef.current = next
      setStore(next)
      if (!saveBlocked) saveStore(next)
    },
    [saveBlocked],
  )

  /** 편집 중인 모듈만 바꾼다. 없으면 안내만 한다. */
  const editActive = (fn: (m: SurveyModule) => SurveyModule, record = true): boolean => {
    const s = storeRef.current
    if (!findModule(s, s.activeModuleId)) {
      setNotice('편집 중인 모듈이 없어요. "모듈" 탭에서 새 모듈을 시작하거나 이어서 편집할 모듈을 고르세요.')
      return false
    }
    commit(updateModule(s, s.activeModuleId!, fn), record)
    return true
  }

  const undo = () => {
    const prev = historyRef.current.pop()
    if (!prev) return setNotice('되돌릴 게 없어요')
    commit(prev, false)
    setNotice('')
  }

  return { store, storeRef, commit, editActive, undo }
}

export type SurveyV2Store = ReturnType<typeof useSurveyV2Store>
