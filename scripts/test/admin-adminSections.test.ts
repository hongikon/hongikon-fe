import { test } from 'node:test'
import assert from 'node:assert/strict'

import { SECTION_PATHS, navBadgeCount, navBadgeText, sectionFromPath } from '../../src/admin/utils/shell/adminSections'
import type { AdminOverview, AdminSection } from '../../src/admin/types'

test('sectionFromPath: 끝 / 무시, 모르는 경로는 대시보드', () => {
  assert.equal(sectionFromPath('/admin'), 'dashboard')
  assert.equal(sectionFromPath('/admin/reports/'), 'reports')
  assert.equal(sectionFromPath('/admin/ask-feedback'), 'askFeedback')
  assert.equal(sectionFromPath('/admin/nope'), 'dashboard')
  for (const section of Object.keys(SECTION_PATHS) as AdminSection[]) {
    assert.equal(sectionFromPath(SECTION_PATHS[section]), section)
  }
})

test('navBadgeCount·navBadgeText', () => {
  const overview = { reports: { pending: 3 }, feedback: { open: 120 }, comments: { flaggedPending: 2 } } as AdminOverview
  assert.equal(navBadgeCount(overview, 'reports'), 3)
  assert.equal(navBadgeCount(overview, 'feedback'), 120)
  assert.equal(navBadgeCount(overview, 'comments'), 2)
  assert.equal(navBadgeCount(overview, 'users'), 0)
  assert.equal(navBadgeCount({ ...overview, comments: undefined } as AdminOverview, 'comments'), 0)
  assert.equal(navBadgeCount(null, 'reports'), 0)
  assert.equal(navBadgeText(99), 99)
  assert.equal(navBadgeText(120), '99+')
})
