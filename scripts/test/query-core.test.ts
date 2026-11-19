import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createLatestGate } from '../../src/utils/query/latestGate'
import { createInvalidationBus, invalidateQueries, keyMatches } from '../../src/utils/query/invalidation'
import {
  patchListItem,
  reinsertListItem,
  removeListItem,
  restoreListItem,
  runMutation,
} from '../../src/utils/query/mutation'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('낙관적 반영: 먼저 바꾸고 성공하면 그대로 둔다', async () => {
  let liked = false
  const calls: string[] = []
  const pending = deferred<{ liked: boolean }>()
  const run = runMutation(true, {
    mutationFn: () => pending.promise,
    signal: new AbortController().signal,
    isAlive: () => true,
    onMutate: (next) => {
      const prev = liked
      liked = next
      calls.push('mutate')
      return prev
    },
    onSuccess: (result) => {
      liked = result.liked
      calls.push('success')
    },
    onError: () => calls.push('error'),
    onSettled: () => calls.push('settled'),
  })
  assert.equal(liked, true, '응답 전에 이미 바뀐다')
  pending.resolve({ liked: true })
  const outcome = await run
  assert.deepEqual(outcome, { status: 'success', result: { liked: true } })
  assert.deepEqual(calls, ['mutate', 'success', 'settled'])
})

test('실패하면 snapshot 으로 되돌린다', async () => {
  let count = 3
  const error = new Error('500')
  const outcome = await runMutation(1, {
    mutationFn: async () => {
      throw error
    },
    signal: new AbortController().signal,
    isAlive: () => true,
    onMutate: (delta) => {
      const prev = count
      count += delta
      return prev
    },
    onError: (_e, _v, snapshot) => {
      count = snapshot ?? count
    },
  })
  assert.equal(count, 3)
  assert.deepEqual(outcome, { status: 'error', error })
})

test('화면이 닫히면(끊으면) 응답 뒤 콜백을 부르지 않는다', async () => {
  const controller = new AbortController()
  let alive = true
  const calls: string[] = []
  const pending = deferred<string>()
  const run = runMutation(undefined, {
    mutationFn: () => pending.promise,
    signal: controller.signal,
    isAlive: () => alive,
    onSuccess: () => calls.push('success'),
    onError: () => calls.push('error'),
    onSettled: () => calls.push('settled'),
  })
  alive = false
  controller.abort()
  pending.resolve('late')
  assert.deepEqual(await run, { status: 'cancelled' })
  assert.deepEqual(calls, [])

  const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
  const cancelled = await runMutation(undefined, {
    mutationFn: async () => {
      throw abortError
    },
    signal: new AbortController().signal,
    isAlive: () => true,
    onError: () => calls.push('error'),
  })
  assert.deepEqual(cancelled, { status: 'cancelled' })
  assert.deepEqual(calls, [])
})

test('늦게 온 옛 응답은 무시한다', () => {
  const gate = createLatestGate()
  const first = gate.begin()
  const second = gate.begin()
  assert.equal(gate.isCurrent(first), false)
  assert.equal(gate.isCurrent(second), true)
  gate.close()
  assert.equal(gate.isCurrent(second), false)
})

test('무효화는 같은 키와 그 아래 키를 깨운다', () => {
  assert.equal(keyMatches('reports:mine', 'reports'), true)
  assert.equal(keyMatches('reports', 'reports:mine'), false)
  assert.equal(keyMatches('reportsX', 'reports'), false)
  const bus = createInvalidationBus()
  const woke: string[] = []
  const off = bus.subscribe('reports:mine', () => woke.push('mine'))
  bus.subscribe('reports', () => woke.push('all'))
  bus.subscribe('news', () => woke.push('news'))
  assert.equal(bus.invalidate('reports'), 2)
  assert.deepEqual(woke.sort(), ['all', 'mine'])
  off()
  woke.length = 0
  invalidateQueries(['reports:mine', 'news'], bus)
  assert.deepEqual(woke, ['news'])
})

test('목록 낙관적 수정·삭제와 되돌리기', () => {
  const list = [
    { id: 1, liked: false },
    { id: 2, liked: false },
  ]
  const byId = (id: number) => (item: { id: number }) => item.id === id
  const { next, previous } = patchListItem(list, byId(2), (item) => ({ ...item, liked: true }))
  assert.equal(next[1].liked, true)
  assert.deepEqual(restoreListItem(next, byId(2), previous), list)
  assert.equal(restoreListItem(next, byId(9), undefined), next)

  const removed = removeListItem(list, byId(1))
  assert.deepEqual(removed.next.map((i) => i.id), [2])
  assert.deepEqual(reinsertListItem(removed.next, removed.removed, byId(1)).map((i) => i.id), [1, 2])
  // 그 사이 다시 들어왔으면 그대로
  assert.deepEqual(reinsertListItem(list, removed.removed, byId(1)).map((i) => i.id), [1, 2])
  assert.equal(removeListItem(list, byId(9)).removed, null)
})
