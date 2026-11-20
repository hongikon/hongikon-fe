import { test } from 'node:test'
import assert from 'node:assert/strict'

import { hasAlcoholBenefit, partnerBenefitGroups, splitBulletItems } from '../../src/utils/map/partnerBenefits'
import { PARTNER_AFFILIATION_USAGE_NOTES } from '../../src/constants/partnerAffiliations'
import type { Partner } from '../../src/types'

const p = (extra: Partial<Partner>) => ({ id: 'x', name: '가게', category: '음식점', lat: 0, lng: 0, ...extra }) as Partner

test('" / " 로만 항목을 나눈다', () => {
  assert.deepEqual(splitBulletItems('10% 할인 / 음료 무료'), ['10% 할인', '음료 무료'])
  assert.deepEqual(splitBulletItems('단품/세트 10%'), ['단품/세트 10%'])
})

test('주류 혜택: 주점은 늘, 그 밖은 술 이름이 있을 때만(주류 제외는 아님)', () => {
  assert.equal(hasAlcoholBenefit(p({ category: '주점' })), true)
  assert.equal(hasAlcoholBenefit(p({ benefit: '하이볼 1잔 무료' })), true)
  assert.equal(hasAlcoholBenefit(p({ benefit: '전 메뉴 10% (주류 제외)' })), false)
  assert.equal(hasAlcoholBenefit(p({ affiliationBenefits: [{ affiliation: '총학생회', benefit: '맥주 1병' }] } as never)), true)
})

test('예외 소속은 기본 칩에서 빠지고, 기숙사 안내는 맨 뒤', () => {
  const affiliations = Object.keys(PARTNER_AFFILIATION_USAGE_NOTES)
  assert.ok(affiliations.includes('기숙사'))
  const other = affiliations.find((a) => a !== '기숙사' && PARTNER_AFFILIATION_USAGE_NOTES[a as never] !== PARTNER_AFFILIATION_USAGE_NOTES.기숙사)!
  const groups = partnerBenefitGroups(
    p({
      benefit: '10%',
      affiliations: ['기숙사', other, '예외'] as never,
      affiliationBenefits: [{ affiliation: '예외', benefit: '20%' }] as never,
      affiliationEnds: [{ affiliation: other, endsOn: '2026-12-31' }] as never,
    }),
  )
  assert.deepEqual(groups.baseAffiliations, ['기숙사', other])
  assert.deepEqual(groups.baseAffiliationEnds, [other])
  assert.equal(groups.baseUsageNotes[groups.baseUsageNotes.length - 1], PARTNER_AFFILIATION_USAGE_NOTES.기숙사)
  assert.equal(groups.ownUsageNote, null)
})

test('업체 자체 이용 방법이 있으면 그것만', () => {
  const groups = partnerBenefitGroups(p({ benefit: '10%', usageNote: ' QR 코드 ', affiliations: ['기숙사'] as never }))
  assert.equal(groups.ownUsageNote, 'QR 코드')
  assert.deepEqual(groups.baseUsageNotes, ['QR 코드'])
})
