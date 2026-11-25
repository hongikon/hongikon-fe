import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pinnedPartnerGroup, searchResultSections } from '../../src/utils/map/partner/partnerSearchSections'

const partner = (id: string) => ({ id, name: id }) as never
const facility = (id: string) => ({ facility: { id }, title: id, subtitle: '' }) as never

test('편의시설·제휴 둘 다 있을 때만 구획 제목', () => {
  assert.deepEqual(searchResultSections([], []), [])
  const only = searchResultSections([], [partner('a')])
  assert.equal(only.length, 1)
  assert.equal(only[0].title, null)
  assert.equal(only[0].data[0].key, 'p:a')
  const both = searchResultSections([facility('f1')], [partner('a')])
  assert.deepEqual(both.map((s) => s.title), ['편의시설', '제휴 업체'])
  assert.equal(both[0].data[0].key, 'f:f1')
})

test('따로 모을 묶음: 넘겨받은 것 → 먼 업체 → 없음', () => {
  const pinned = { title: '필터', partners: [partner('a')] }
  assert.equal(pinnedPartnerGroup(pinned, [partner('b')]), pinned)
  assert.equal(pinnedPartnerGroup({ title: '빈', partners: [] }, [partner('b')])?.title, '지도에 안 보이는 곳')
  assert.equal(pinnedPartnerGroup(undefined, []), null)
})
