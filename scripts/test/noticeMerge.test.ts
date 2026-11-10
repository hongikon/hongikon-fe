import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { AppNotice } from '../../src/constants/appNotices'
import { currentPopupNotice, fromServerNotice, mergeNotices } from '../../src/utils/noticeMerge'

const local = (id: string, date: string, until?: string): AppNotice => ({
  id,
  title: `local ${id}`,
  date,
  body: 'b',
  popup: until ? { until, slides: [{ icon: 'megaphone-outline', title: 't', text: 'x' }], linkLabel: 'l' } : undefined,
})

test('server notice becomes an app notice with KST date, prefixed id and timed popup', () => {
  const n = fromServerNotice({
    id: 12,
    title: '축제 안내',
    body: '본문',
    publishedAt: '2026-11-09T15:30:00', // UTC → KST 11-10 00:30
    popup: { text: '요약', until: '2026-11-12T00:00:00' },
  })
  assert.ok(n)
  assert.equal(n.id, 's12')
  assert.equal(n.date, '2026.11.10')
  assert.equal(n.publishedMs, Date.parse('2026-11-09T15:30:00Z'))
  assert.equal(n.popup?.untilMs, Date.parse('2026-11-12T00:00:00Z'))
  assert.equal(n.popup?.slides[0].text, '요약')
  assert.equal(fromServerNotice({ id: 1, title: '', body: 'b', publishedAt: '2026-11-09T00:00:00' }), null)
  assert.equal(fromServerNotice({ id: 1, title: 't', body: 'b', publishedAt: 'nope' }), null)
})

test('merge sorts newest first across local and server notices', () => {
  const server = fromServerNotice({ id: 3, title: 's', body: 'b', publishedAt: '2026-11-08T01:00:00' })!
  const merged = mergeNotices([local('7', '2026.11.06'), local('8', '2026.11.09')], [server])
  assert.deepEqual(merged.map((n) => n.id), ['8', 's3', '7'])
})

test('popup: local uses KST day, server uses exact time', () => {
  const now = Date.parse('2026-11-12T03:00:00Z') // KST 11-12 12:00
  const ended = fromServerNotice({ id: 1, title: 's', body: 'b', publishedAt: '2026-11-11T00:00:00', popup: { text: 'x', until: '2026-11-12T02:59:00' } })!
  const live = fromServerNotice({ id: 2, title: 's', body: 'b', publishedAt: '2026-11-10T00:00:00', popup: { text: 'x', until: '2026-11-12T03:01:00' } })!
  assert.equal(currentPopupNotice([ended, live], now)?.id, 's2')
  assert.equal(currentPopupNotice([ended, local('9', '2026.11.01', '2026-11-12')], now)?.id, '9')
  assert.equal(currentPopupNotice([ended, local('9', '2026.11.01', '2026-11-11')], now), null)
})
