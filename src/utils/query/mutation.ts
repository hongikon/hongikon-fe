/**
 * 저장(POST/PUT/PATCH/DELETE) 한 번의 흐름. 화면 상태와 무관한 순수 로직이라 `useMutation` 이 이걸 부르고,
 * 테스트도 이걸로 한다.
 *
 * 1. `onMutate(vars)` — 낙관적 반영. 화면을 먼저 바꾸고, 되돌릴 때 쓸 값(snapshot)을 돌려준다.
 * 2. `mutationFn(vars, signal)` — 서버 요청.
 * 3. 성공이면 `onSuccess(result, vars, snapshot)`, 실패면 `onError(error, vars, snapshot)`(여기서 되돌린다).
 * 4. 끝나면 `onSettled`.
 *
 * `isAlive()` 가 false 면(화면이 닫힘·끊음) 요청 뒤의 콜백을 부르지 않는다 — 닫힌 화면의 상태를 건드리지 않게.
 * 끊긴 요청(AbortError)도 실패로 알리지 않는다.
 */
export interface MutationCallbacks<TVars, TResult, TSnapshot> {
  onMutate?: (vars: TVars) => TSnapshot
  onSuccess?: (result: TResult, vars: TVars, snapshot: TSnapshot | undefined) => void
  onError?: (error: unknown, vars: TVars, snapshot: TSnapshot | undefined) => void
  onSettled?: (vars: TVars, snapshot: TSnapshot | undefined) => void
}

export type MutationOutcome<TResult> =
  | { status: 'success'; result: TResult }
  | { status: 'error'; error: unknown }
  /** 화면이 닫혔거나 끊었다. 결과는 버렸다. */
  | { status: 'cancelled' }

export interface RunMutationOptions<TVars, TResult, TSnapshot> extends MutationCallbacks<TVars, TResult, TSnapshot> {
  mutationFn: (vars: TVars, signal: AbortSignal) => Promise<TResult>
  signal: AbortSignal
  /** 콜백을 불러도 되는지(화면이 살아 있고 끊지 않았는지). */
  isAlive: () => boolean
  /** 끊긴 요청 오류인지(client 의 RequestCancelledError 등). 기본은 AbortError 이름만 본다. */
  isCancelled?: (error: unknown) => boolean
}

function defaultIsCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export async function runMutation<TVars, TResult, TSnapshot>(
  vars: TVars,
  options: RunMutationOptions<TVars, TResult, TSnapshot>,
): Promise<MutationOutcome<TResult>> {
  const { mutationFn, signal, isAlive, onMutate, onSuccess, onError, onSettled } = options
  const isCancelled = options.isCancelled ?? defaultIsCancelled
  const snapshot = onMutate ? onMutate(vars) : undefined
  try {
    const result = await mutationFn(vars, signal)
    if (signal.aborted || !isAlive()) return { status: 'cancelled' }
    onSuccess?.(result, vars, snapshot)
    onSettled?.(vars, snapshot)
    return { status: 'success', result }
  } catch (error) {
    if (signal.aborted || !isAlive() || isCancelled(error)) return { status: 'cancelled' }
    onError?.(error, vars, snapshot)
    onSettled?.(vars, snapshot)
    return { status: 'error', error }
  }
}

/**
 * 낙관적 반영을 위한 목록 도우미. `apply` 로 바꾼 목록과, 실패하면 그 항목만 되돌리는 `revert` 를 만든다.
 * 그 사이 다른 항목이 바뀌었어도(다른 저장·새로 받기) 그 변화는 지키고 해당 항목만 원래대로 돌린다.
 */
export function patchListItem<T>(
  list: readonly T[],
  match: (item: T) => boolean,
  patch: (item: T) => T,
): { next: T[]; previous: T | undefined } {
  let previous: T | undefined
  const next = list.map((item) => {
    if (!match(item)) return item
    previous = item
    return patch(item)
  })
  return { next, previous }
}

/** `patchListItem` 으로 바꾼 항목을 되돌린다(같은 자리에 아직 있으면). */
export function restoreListItem<T>(list: readonly T[], match: (item: T) => boolean, previous: T | undefined): T[] {
  if (previous === undefined) return list as T[]
  return list.map((item) => (match(item) ? previous : item))
}

/** 낙관적 삭제: 지운 목록과, 되돌릴 때 원래 자리에 다시 넣을 정보. */
export function removeListItem<T>(
  list: readonly T[],
  match: (item: T) => boolean,
): { next: T[]; removed: { item: T; index: number } | null } {
  const index = list.findIndex(match)
  if (index < 0) return { next: list as T[], removed: null }
  return { next: [...list.slice(0, index), ...list.slice(index + 1)], removed: { item: list[index], index } }
}

/** `removeListItem` 을 되돌린다. 그 사이 같은 항목이 다시 들어왔으면 그대로 둔다. */
export function reinsertListItem<T>(
  list: readonly T[],
  removed: { item: T; index: number } | null,
  match: (item: T) => boolean,
): T[] {
  if (!removed || list.some(match)) return list as T[]
  const index = Math.min(removed.index, list.length)
  return [...list.slice(0, index), removed.item, ...list.slice(index)]
}
