import { test } from 'node:test'
import assert from 'node:assert/strict'

import { applyReviewed, filterByReason, reasonChipOptions } from '../../src/admin/utils/askFeedback'
import type { AdminAskFeedbackItem, AdminAskFeedbackResponse } from '../../src/admin/types'

const item = (id: number, source: 'ROUTE' | 'FLOW', reason: AdminAskFeedbackItem['reason']) =>
  ({ id, source, reason, reviewedAt: null }) as AdminAskFeedbackItem

const DATA: AdminAskFeedbackResponse = {
  days: 30,
  items: [item(1, 'ROUTE', 'WRONG'), item(1, 'FLOW', null), item(2, 'ROUTE', 'OUTDATED')],
  reasons: { WRONG: 1, NONE: 1, OUTDATED: 1 },
}

test('filterByReason: 이유 없음은 NONE', () => {
  assert.equal(filterByReason(DATA.items, 'ALL').length, 3)
  assert.deepEqual(filterByReason(DATA.items, 'NONE').map((i) => i.source), ['FLOW'])
  assert.deepEqual(filterByReason(DATA.items, 'WRONG').map((i) => i.id), [1])
})

test('reasonChipOptions', () => {
  const chips = reasonChipOptions(DATA)
  assert.deepEqual(chips.map((c) => c.value), ['ALL', 'WRONG', 'OUTDATED', 'OFF_TOPIC', 'NOT_ENOUGH', 'NONE'])
  assert.equal(chips[0].count, 3)
  assert.equal(chips[3].count, 0)
  assert.equal(reasonChipOptions(null)[0].count, undefined)
})

test('applyReviewed 는 출처와 id 가 모두 같은 줄만 바꾼다', () => {
  const next = applyReviewed(DATA, { source: 'ROUTE', id: 1 }, true, '2026-11-19T00:00:00.000Z')
  assert.equal(next?.items[0].reviewedAt, '2026-11-19T00:00:00.000Z')
  assert.equal(next?.items[1].reviewedAt, null)
  assert.equal(applyReviewed(next, { source: 'ROUTE', id: 1 }, false, 'x')?.items[0].reviewedAt, null)
  assert.equal(applyReviewed(null, { source: 'ROUTE', id: 1 }, true, 'x'), null)
})

import { askReasonText, upsertAskNote } from '../../src/admin/utils/askFeedback'
import type { AdminAskNote } from '../../src/admin/types'

test('askReasonText: 많은 순, 0건 제외, 모르는 코드는 그대로', () => {
  assert.equal(askReasonText({ NOT_ENOUGH: 1, WRONG: 3, OUTDATED: 0, X: 2 }), '틀린 정보 3 · X 2 · 부족함 1')
  assert.equal(askReasonText({}), '')
})

test('upsertAskNote', () => {
  const note = (id: number, active = true) => ({ id, active }) as AdminAskNote
  assert.deepEqual(upsertAskNote(null, note(1)).map((n) => n.id), [1])
  const next = upsertAskNote([note(3), note(1)], note(2))
  assert.deepEqual(next.map((n) => n.id), [3, 2, 1])
  assert.equal(upsertAskNote(next, note(2, false)).find((n) => n.id === 2)?.active, false)
})
