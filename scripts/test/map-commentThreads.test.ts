import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  appendReply,
  commentRemovalCounts,
  moreCommentsLabel,
  nextCommentPage,
  removeCommentFromThreads,
  visibleThreads,
} from '../../src/utils/map/report/commentThreads'
import type { ReportComment } from '../../src/types'

const c = (id: number, extra: Partial<ReportComment> = {}) => ({ id, content: `c${id}`, ...extra }) as ReportComment

test('숨긴 사용자의 댓글과 답글을 뺀다', () => {
  const items = [c(1, { authorKey: 'a' }), c(2, { authorKey: 'b', replies: [c(3, { authorKey: 'a' }), c(4, { authorKey: 'b' })] })]
  assert.equal(visibleThreads(items, new Set()), items)
  const shown = visibleThreads(items, new Set(['a']))
  assert.deepEqual(shown.map((x) => x.id), [2])
  assert.deepEqual(shown[0].replies?.map((x) => x.id), [4])
})

test('다음 페이지: 빠진 게 없으면 다음 쪽, 있으면 당겨진 쪽', () => {
  assert.equal(nextCommentPage(1, 0, 10), 2)
  assert.equal(nextCommentPage(1, 1, 10), 1)
  assert.equal(nextCommentPage(0, 15, 10), 0)
})

test('지운 최상위 댓글: 답글이 있으면 자리로, 없으면 빠진다', () => {
  const items = [c(1, { replyCount: 2, replies: [c(5), c(6)] }), c(2, { replyCount: 0 })]
  assert.deepEqual(commentRemovalCounts(items, 2), { top: true, total: true })
  assert.deepEqual(commentRemovalCounts(items, 1), { top: true, total: false })
  assert.deepEqual(commentRemovalCounts(items, 5), { top: false, total: false })
  const after = removeCommentFromThreads(items, 1, 'HIDDEN')
  assert.equal(after[0].placeholder, 'HIDDEN')
  assert.equal(after[0].content, null)
  assert.deepEqual(removeCommentFromThreads(items, 2, 'DELETED').map((x) => x.id), [1])
})

test('자리만 남은 댓글의 마지막 답글을 지우면 자리도 없어진다', () => {
  const items = [c(1, { placeholder: 'DELETED', replyCount: 1, replies: [c(5)] })]
  assert.deepEqual(commentRemovalCounts(items, 5), { top: true, total: true })
  assert.deepEqual(removeCommentFromThreads(items, 5, 'DELETED'), [])
  const two = [c(1, { replyCount: 2, replies: [c(5), c(6)] })]
  const left = removeCommentFromThreads(two, 5, 'DELETED')
  assert.equal(left[0].replyCount, 1)
  assert.deepEqual(left[0].replies?.map((x) => x.id), [6])
})

test('답글 붙이기와 더 보기 문구', () => {
  const items = appendReply([c(1, { replyCount: 0 }), c(2)], c(9, { parentId: 1 }))
  assert.equal(items[0].replyCount, 1)
  assert.deepEqual(items[0].replies?.map((x) => x.id), [9])
  assert.equal(moreCommentsLabel(25, 10), '댓글 15개 더 보기')
  assert.equal(moreCommentsLabel(5, 10), '댓글 더 보기')
})
