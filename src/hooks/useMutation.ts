import { useCallback, useEffect, useRef, useState } from 'react'
import { isCancelledError } from '../apis/client'
import { invalidateQueries, type QueryKey } from '../utils/query/invalidation'
import { runMutation, type MutationCallbacks, type MutationOutcome } from '../utils/query/mutation'

export interface UseMutationOptions<TVars, TResult, TSnapshot> extends MutationCallbacks<TVars, TResult, TSnapshot> {
  /** 성공하면 이 키들의 조회(`useQuery`)를 다시 부른다. */
  invalidates?: readonly QueryKey[]
}

export interface Mutation<TVars, TResult> {
  /**
   * 저장을 보낸다. 결과를 기다려야 하면 await 한다(성공·실패·취소). 콜백(onSuccess 등)만 쓰면 기다리지 않아도 된다.
   * 매 렌더 같은 함수라 memo 자식에 그대로 넘겨도 된다.
   */
  mutate: (vars: TVars) => Promise<MutationOutcome<TResult>>
  /** 보내는 중인지(마지막 요청 기준). */
  pending: boolean
  /** 보내는 중인 값(예: 지우는 중인 댓글 id 표시). */
  pendingVars: TVars | undefined
  /** 진행 중인 요청을 끊는다(결과·콜백을 버린다). */
  cancel: () => void
}

/**
 * 저장 공통 훅. 낙관적 반영(`onMutate` → 실패 시 `onError` 에서 되돌림), 화면을 닫으면 끊기, 성공 뒤 조회 다시 부르기를 묶는다.
 * 옵션(콜백)은 매 렌더 새로 만들어도 된다 — 늘 최신 콜백을 쓰고 `mutate` 자체는 바뀌지 않는다.
 *
 * 여러 번 눌러도 요청마다 따로 흐른다(좋아요를 빠르게 여러 번 누르는 경우 등). 마지막 요청만 반영하려면 호출부가 막는다.
 */
export function useMutation<TVars = void, TResult = unknown, TSnapshot = undefined>(
  mutationFn: (vars: TVars, signal: AbortSignal) => Promise<TResult>,
  options: UseMutationOptions<TVars, TResult, TSnapshot> = {},
): Mutation<TVars, TResult> {
  const fnRef = useRef(mutationFn)
  fnRef.current = mutationFn
  const optionsRef = useRef(options)
  optionsRef.current = options
  const aliveRef = useRef(true)
  const controllersRef = useRef(new Set<AbortController>())
  const latestRef = useRef(0)
  const [pendingState, setPendingState] = useState<{ vars: TVars } | null>(null)

  useEffect(() => {
    aliveRef.current = true
    const controllers = controllersRef.current
    return () => {
      aliveRef.current = false
      for (const controller of controllers) controller.abort()
      controllers.clear()
    }
  }, [])

  const mutate = useCallback(async (vars: TVars) => {
    const controller = new AbortController()
    controllersRef.current.add(controller)
    latestRef.current += 1
    const token = latestRef.current
    setPendingState({ vars })
    const { invalidates, ...callbacks } = optionsRef.current
    const outcome = await runMutation<TVars, TResult, TSnapshot>(vars, {
      mutationFn: (v, signal) => fnRef.current(v, signal),
      signal: controller.signal,
      isAlive: () => aliveRef.current,
      isCancelled: (error) => isCancelledError(error) || (error instanceof Error && error.name === 'AbortError'),
      onMutate: callbacks.onMutate && ((v) => optionsRef.current.onMutate!(v)),
      onSuccess: (result, v, snapshot) => optionsRef.current.onSuccess?.(result, v, snapshot),
      onError: (error, v, snapshot) => optionsRef.current.onError?.(error, v, snapshot),
      onSettled: (v, snapshot) => optionsRef.current.onSettled?.(v, snapshot),
    })
    controllersRef.current.delete(controller)
    // 화면이 닫힌 뒤 성공한 저장(detached)도 서버에는 반영됐으니 다른 화면의 목록은 새로 부른다.
    if ((outcome.status === 'success' || outcome.status === 'detached') && invalidates?.length) invalidateQueries(invalidates)
    if (aliveRef.current && token === latestRef.current) setPendingState(null)
    return outcome
  }, [])

  const cancel = useCallback(() => {
    for (const controller of controllersRef.current) controller.abort()
    controllersRef.current.clear()
    latestRef.current += 1
    if (aliveRef.current) setPendingState(null)
  }, [])

  return { mutate, pending: pendingState !== null, pendingVars: pendingState?.vars, cancel }
}
