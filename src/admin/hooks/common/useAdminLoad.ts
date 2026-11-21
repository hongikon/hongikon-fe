import { useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react'
import { isCancelledError } from '../../../apis/client'

export interface AdminLoad<T> {
  /** 받은 값. 처음엔 null(아직 못 받음). 화면이 처리 결과를 반영하거나 조건을 바꿀 때 비우려고 직접 바꿀 수도 있다. */
  data: T | null
  setData: Dispatch<SetStateAction<T | null>>
  loading: boolean
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  /** 같은 조건으로 다시 불러온다(새로고침·다시 시도). */
  reload: () => void
}

/**
 * 관리 화면들이 똑같이 쓰던 '목록 불러오기': `deps` 가 바뀌거나 `reload()` 하면 이전 요청을 끊고 다시 받는다.
 * 받는 동안 이전 값은 그대로 둔다(새로고침 버튼 옆 로딩 표시용). 취소된 요청의 오류는 무시하고,
 * 끊긴 요청은 loading 을 내리지 않는다(뒤이은 요청이 내린다).
 *
 * `load` 는 매번 새 함수여도 된다 — 마지막 렌더의 것을 쓰고, 다시 부르는 시점은 `deps`·`reload` 로만 정한다.
 */
export function useAdminLoad<T>(
  load: (signal: AbortSignal) => Promise<T>,
  errorMessage: (err: unknown) => string,
  deps: DependencyList,
): AdminLoad<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load
  const errorMessageRef = useRef(errorMessage)
  errorMessageRef.current = errorMessage

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    loadRef
      .current(controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(errorMessageRef.current(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [...deps, reloadKey])

  const reload = () => setReloadKey((key) => key + 1)

  return { data, setData, loading, error, setError, reload }
}
