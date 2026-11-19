/**
 * 조회 다시 부르기 알림판. 조회(`useQuery`)는 자기 키로 구독하고, 저장(`useMutation`)이 성공하면 바뀐 키를
 * `invalidate` 해 같은 데이터를 보여 주는 다른 화면도 새로 받게 한다.
 *
 * 키는 `'reports'`·`'reports:mine'` 처럼 `:` 로 나눈다. `invalidate('reports')` 는 `'reports'` 와
 * `'reports:…'` 를 모두 깨운다(앞부분 일치). 거꾸로 `invalidate('reports:mine')` 는 `'reports'` 를 깨우지 않는다.
 */
export type QueryKey = string

type Listener = () => void

export interface InvalidationBus {
  subscribe: (key: QueryKey, listener: Listener) => () => void
  invalidate: (key: QueryKey) => number
}

/** `target` 을 무효화하면 `key` 로 구독한 조회도 다시 불러야 하는지. */
export function keyMatches(key: QueryKey, target: QueryKey): boolean {
  return key === target || key.startsWith(`${target}:`)
}

export function createInvalidationBus(): InvalidationBus {
  const listeners = new Map<QueryKey, Set<Listener>>()
  return {
    subscribe(key, listener) {
      let set = listeners.get(key)
      if (!set) {
        set = new Set()
        listeners.set(key, set)
      }
      set.add(listener)
      return () => {
        const current = listeners.get(key)
        if (!current) return
        current.delete(listener)
        if (current.size === 0) listeners.delete(key)
      }
    },
    /** 깨운 구독 수를 돌려준다(테스트·디버그용). */
    invalidate(target) {
      let woken = 0
      for (const [key, set] of [...listeners]) {
        if (!keyMatches(key, target)) continue
        for (const listener of [...set]) {
          woken += 1
          listener()
        }
      }
      return woken
    },
  }
}

/** 앱 전체가 같이 쓰는 알림판. */
export const queryBus = createInvalidationBus()

/** 저장이 끝난 뒤 이 키들의 조회를 다시 부른다. */
export function invalidateQueries(keys: readonly QueryKey[], bus: InvalidationBus = queryBus): void {
  for (const key of keys) bus.invalidate(key)
}
