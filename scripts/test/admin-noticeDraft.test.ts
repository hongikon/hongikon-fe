import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildNoticeInput,
  emptyNoticeDraft,
  formatKst,
  groupNotices,
  noticeSavedMessage,
  parseKstInput,
  popupTogglePatch,
  toKstInput,
} from '../../src/admin/utils/noticeDraft'
import type { AdminNotice } from '../../src/admin/types'

const kst = (text: string) => Date.parse(`${text.replace(' ', 'T')}:00+09:00`)

test('toKstInput·parseKstInput 왕복, 없는 날짜는 null', () => {
  const ms = kst('2026-11-10 09:00')
  assert.equal(toKstInput(ms), '2026-11-10 09:00')
  assert.equal(parseKstInput(' 2026-11-10 09:00 '), ms)
  assert.equal(parseKstInput('2026-02-30 09:00'), null)
  assert.equal(parseKstInput('2026-11-10 9:00'), null)
})

test('formatKst', () => {
  assert.equal(formatKst(kst('2026-11-10 09:05')), '11/10(화) 09:05')
})

test('emptyNoticeDraft 는 분 단위로 내리고 팝업 종료를 7일 뒤로', () => {
  const draft = emptyNoticeDraft(kst('2026-11-10 09:00') + 42_000)
  assert.equal(draft.publishAt, '2026-11-10 09:00')
  assert.equal(draft.popupUntil, '2026-11-17 09:00')
  assert.equal(draft.popup, false)
})

test('buildNoticeInput: 팝업 기간 검증', () => {
  const base = { ...emptyNoticeDraft(kst('2026-11-10 09:00')), title: '제목', body: '본문' }
  const ok = buildNoticeInput(base)
  assert.ok('input' in ok)
  assert.equal(ok.input.publishAt, new Date(kst('2026-11-10 09:00')).toISOString())
  assert.equal(ok.input.popupUntil, undefined)
  const tooLongPopup = buildNoticeInput({ ...base, popup: true, popupText: '요약', popupUntil: '2026-12-31 09:00' })
  assert.ok('errors' in tooLongPopup)
  assert.deepEqual(tooLongPopup.errors, ['팝업은 게시 후 31일까지만 띄울 수 있어요.'])
  const noText = buildNoticeInput({ ...base, popup: true, popupUntil: '2026-11-09 09:00' })
  assert.ok('errors' in noText)
  assert.deepEqual(noText.errors, ['팝업 문구를 입력해 주세요(앱을 켤 때 카드에 보이는 짧은 요약).', '팝업 종료 시각은 게시 시각보다 뒤여야 해요.'])
})

test('popupTogglePatch: 새로 켤 때만 종료 시각을 게시 + 7일로', () => {
  const draft = { ...emptyNoticeDraft(kst('2026-11-10 09:00')), publishAt: '2026-11-20 10:00' }
  assert.deepEqual(popupTogglePatch(draft, true), { popup: true, popupUntil: '2026-11-27 10:00' })
  assert.deepEqual(popupTogglePatch({ ...draft, popup: true }, true), { popup: true })
  assert.deepEqual(popupTogglePatch(draft, false), { popup: false })
  assert.deepEqual(popupTogglePatch({ ...draft, publishAt: 'x' }, true), { popup: true })
})

// 서버 시각은 존 없는 UTC.
const notice = (id: number, publishAt: string) => ({ id, title: `공지 ${id}`, body: '', publishAt }) as AdminNotice

test('groupNotices·noticeSavedMessage', () => {
  const now = Date.parse('2026-11-10T00:00:00Z')
  const groups = groupNotices([notice(1, '2026-11-09T00:00:00'), notice(2, '2026-11-12T00:00:00'), notice(3, '2026-11-11T00:00:00'), notice(4, '2026-11-09T00:00:00')], now)
  assert.deepEqual(groups.scheduled.map((n) => n.id), [3, 2])
  assert.deepEqual(groups.published.map((n) => n.id), [4, 1])
  assert.equal(noticeSavedMessage(notice(1, '2026-11-09T00:00:00'), now), "'공지 1' 공지를 게시했습니다. 앱을 새로 켜면 보입니다.")
  assert.equal(noticeSavedMessage(notice(2, '2026-11-12T00:00:00'), now), "'공지 2' 공지를 예약했습니다. 11/12(목) 09:00부터 앱에 보입니다.")
})
