import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  commentActionLabel,
  commentActionsFor,
  commentStatusLabel,
  flagCountLabel,
  flagReasonsText,
  topReasonLabel,
} from '../../src/admin/utils/commentModeration'
import { withFocusedFirst } from '../../src/admin/utils/focus'
import type { AdminComment } from '../../src/admin/types'

test('topReasonLabel: 가장 많은 신고 사유, 기타는 건너뛴다', () => {
  assert.equal(topReasonLabel({ SPAM: 1, PRIVACY: 3, OTHER: 9 }), '개인정보 노출')
  assert.equal(topReasonLabel({ OTHER: 2 }), '')
  assert.equal(topReasonLabel(null), '')
})

test('commentActionsFor·commentActionLabel', () => {
  const visible = { status: 'VISIBLE' } as AdminComment
  const hidden = { status: 'HIDDEN' } as AdminComment
  assert.deepEqual(commentActionsFor(visible), ['keep', 'hide', 'delete'])
  assert.deepEqual(commentActionsFor(hidden), ['restore', 'hide', 'delete'])
  assert.deepEqual(commentActionsFor({ status: 'DELETED' } as AdminComment), [])
  assert.equal(commentActionLabel(hidden, 'hide'), '숨김 유지')
  assert.equal(commentActionLabel(visible, 'hide'), '숨김')
})

test('commentStatusLabel·flagCountLabel', () => {
  assert.equal(commentStatusLabel('HIDDEN', false), '자동 숨김')
  assert.equal(commentStatusLabel('HIDDEN', true), '숨김')
  assert.equal(commentStatusLabel('VISIBLE', false), '공개 중')
  assert.equal(commentStatusLabel('DELETED', false), '삭제됨')
  assert.equal(flagCountLabel({ flagCount: 5, pendingFlagCount: 2 }, false), '신고 2건 검토 대기 · 전체 5')
  assert.equal(flagCountLabel({ flagCount: 2, pendingFlagCount: 2 }, false), '신고 2건 검토 대기')
  assert.equal(flagCountLabel({ flagCount: 5, pendingFlagCount: 2 }, true), '신고 5건')
})

test('flagReasonsText 는 모르는 코드를 그대로 쓴다', () => {
  assert.match(flagReasonsText({ UNKNOWN_CODE: 2 } as never), /^UNKNOWN_CODE 2$/)
  assert.equal(flagReasonsText(undefined as never), '')
})

test('withFocusedFirst', () => {
  assert.deepEqual(withFocusedFirst([{ id: 1 }, { id: 2 }], 2).map((i) => i.id), [2, 1])
})
