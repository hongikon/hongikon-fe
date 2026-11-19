import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deptDisplayName, feedEmptyMessage, pickBoardItems, sameSourceIds } from '../../src/utils/news/feed'
import { SUBSCRIBABLE_ITEMS } from '../../src/constants/news'

const n = (id: string, sourceId: string) => ({ id, sourceId }) as never

test('구독 칩 이름은 목록 이름, 모르는 id 는 그대로', () => {
  const first = SUBSCRIBABLE_ITEMS[0]
  assert.equal(deptDisplayName(first.id), first.name)
  assert.equal(deptDisplayName('없는게시판'), '없는게시판')
})

test('게시판 목록은 순서까지 같아야 같다', () => {
  assert.equal(sameSourceIds(['a', 'b'], ['a', 'b']), true)
  assert.equal(sameSourceIds(['a', 'b'], ['b', 'a']), false)
  assert.equal(sameSourceIds([], []), true)
  assert.equal(sameSourceIds(['ab'], ['a', 'b']), false)
})

test('게시판 칩: 전체면 구독 피드, 받는 중이고 비었으면 구독 피드에서 골라 먼저', () => {
  const subscribed = [n('1', 'a'), n('2', 'b'), n('3', 'a')]
  const boardItems = [n('9', 'a')]
  assert.equal(pickBoardItems(null, subscribed, { items: boardItems, loading: false }), subscribed)
  assert.equal(pickBoardItems('a', subscribed, { items: boardItems, loading: true }), boardItems)
  assert.deepEqual(
    pickBoardItems('a', subscribed, { items: [], loading: true }).map((x: { id: string }) => x.id),
    ['1', '3'],
  )
  assert.deepEqual(pickBoardItems('a', subscribed, { items: [], loading: false }), [])
})

test('빈 목록 안내', () => {
  assert.equal(feedEmptyMessage('북마크', 'a'), '북마크한 소식이 없어요')
  assert.equal(feedEmptyMessage('구독', 'a'), '이 게시판의 소식이 아직 없어요')
  assert.equal(feedEmptyMessage('구독', null), '구독한 기관·학과의 소식이 없어요')
})
