import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  UNIVERSITY_BOARD_IDS,
  filterSubscribableGroups,
  universityAllSubscribed,
  universityToggleIds,
} from '../../src/utils/news/deptPick'
import { SUBSCRIBABLE_ITEMS } from '../../src/constants/news'

test('학교 공지 묶음은 대학 게시판 중 국제·취업 게시판을 뺀다', () => {
  assert.ok(UNIVERSITY_BOARD_IDS.length > 0)
  for (const id of ['국제교류실', '글로벌역량지원사업', '취업진로공지', '채용정보']) {
    assert.equal(UNIVERSITY_BOARD_IDS.includes(id), false)
  }
  const groupOf = new Map(SUBSCRIBABLE_ITEMS.map((item) => [item.id, item.group]))
  for (const id of UNIVERSITY_BOARD_IDS) assert.equal(groupOf.get(id), '대학')
})

test('학교 공지: 하나라도 꺼져 있으면 꺼진 것만, 다 켜져 있으면 모두', () => {
  const [first, ...rest] = UNIVERSITY_BOARD_IDS
  assert.deepEqual(universityToggleIds(new Set()), [...UNIVERSITY_BOARD_IDS])
  assert.deepEqual(universityToggleIds(new Set([first])), rest)
  assert.equal(universityAllSubscribed(new Set(UNIVERSITY_BOARD_IDS)), true)
  assert.deepEqual(universityToggleIds(new Set(UNIVERSITY_BOARD_IDS)), [...UNIVERSITY_BOARD_IDS])
})

test('검색은 공백·대소문자를 무시하고 이름·묶음 이름을 본다', () => {
  const all = filterSubscribableGroups('')
  assert.equal(all.reduce((n, g) => n + g.items.length, 0), SUBSCRIBABLE_ITEMS.length)
  const target = SUBSCRIBABLE_ITEMS[SUBSCRIBABLE_ITEMS.length - 1]
  const spaced = target.name.split('').join(' ')
  const hits = filterSubscribableGroups(spaced).flatMap((g) => g.items.map((i) => i.id))
  assert.ok(hits.includes(target.id))
  assert.deepEqual(filterSubscribableGroups('없는학과이름zzz'), [])
})
