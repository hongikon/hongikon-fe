import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DWELL_MS,
  REENTRY_GRACE_MS,
  alertGroup,
  decideOnEnter,
  formatDistance,
  insideAtRegistration,
  preciselyInside,
  partnersNear,
  pickNearest,
  pickTargets,
  reselectRadius,
  stayStartedAt,
  type StayRecord,
} from '../../src/lib/nearbyPartners/rules.ts'
import { nearbyAlertContent } from '../../src/lib/nearbyPartners/copy.ts'
import type { Partner } from '../../src/types/index.ts'

/** 한국 시간 2026-10-27 hh:mm 의 epoch ms. */
function kst(hh: number, mm = 0, day = 27): number {
  return Date.UTC(2026, 9, day, hh - 9, mm)
}

/** 위도 1m ≈ 1/111_320 도. 기준점에서 북쪽으로 meters 만큼 옮긴 좌표. */
const BASE = { lat: 37.5535, lng: 126.9215 }
function north(meters: number): { lat: number; lng: number } {
  return { lat: BASE.lat + meters / 111_320, lng: BASE.lng }
}

function partner(id: string, meters: number, extra: Partial<Partner> = {}): Partner {
  return {
    id,
    name: `업체${id}`,
    category: '카페' as Partner['category'],
    affiliations: ['총학생회'],
    benefit: '음료 10% 할인',
    nearbyAlert: true,
    ...north(meters),
    ...extra,
  }
}

const NOON = kst(12, 0)

test('알림 반경(20m): GPS 오차는 15m 까지만 더하고, 안에 있던 곳은 25m 더 멀어져야 나간다', () => {
  assert.equal(preciselyInside(20, 0, false), true)
  assert.equal(preciselyInside(21, 0, false), false)
  assert.equal(preciselyInside(30, 12, false), true)
  // 오차가 아무리 커도 20 + 15m 까지만.
  assert.equal(preciselyInside(36, 80, false), false)
  assert.equal(preciselyInside(44, 0, true), true)
  assert.equal(preciselyInside(46, 0, true), false)
  assert.equal(preciselyInside(28, null, false, 30), true)
})

test('대상 업체: 관리자 표시·혜택·기한·소속·캠퍼스 겹침으로 거른다', () => {
  const partners = [
    partner('ok', 300),
    partner('notFlagged', 300, { nearbyAlert: undefined }),
    partner('noBenefit', 300, { benefit: undefined }),
    partner('ended', 300, { endsOn: '2026-10-26' }),
    partner('endsToday', 300, { endsOn: '2026-10-27' }),
    partner('collegeOnly', 300, { affiliations: ['미술대학'] }),
    partner('collegeEnded', 300, {
      affiliations: ['미술대학'],
      affiliationEnds: [{ affiliation: '미술대학', endsOn: '2026-10-01' }],
    }),
    partner('onCampus', 0),
  ]
  const campusPoints = [north(-50)]

  const noAffiliation = pickTargets(partners, { affiliation: null, campusPoints, now: NOON }).map((p) => p.id)
  assert.deepEqual(noAffiliation, ['ok', 'endsToday'])

  const art = pickTargets(partners, { affiliation: '미술대학', campusPoints, now: NOON }).map((p) => p.id)
  assert.deepEqual(art, ['ok', 'endsToday', 'collegeOnly'])
})

test('대상 업체: 소속 전용 혜택만 있어도 그 소속에는 대상', () => {
  const p = partner('special', 300, {
    benefit: undefined,
    affiliations: ['총학생회', '공과대학'],
    affiliationBenefits: [{ affiliation: '공과대학', benefit: '공대생 15% 할인' }],
  })
  assert.equal(pickTargets([p], { affiliation: null, campusPoints: [], now: NOON }).length, 0)
  assert.equal(pickTargets([p], { affiliation: '공과대학', campusPoints: [], now: NOON }).length, 1)
  // 현장 테스트 빌드: 소속과 상관없이(기본 혜택이 있는 다른 소속 전용 제휴도 대상).
  const liberalOnly = partner('liberal', 300, { affiliations: ['문과대학'] })
  assert.equal(pickTargets([liberalOnly], { affiliation: null, campusPoints: [], now: NOON }).length, 0)
  assert.equal(pickTargets([liberalOnly], { affiliation: null, campusPoints: [], now: NOON, anyAffiliation: true }).length, 1)
})

test('가까운 업체 고르기: 거리순, 같으면 id 순, 개수 제한', () => {
  const partners = [partner('c', 400), partner('b', 100), partner('a', 100), partner('d', 50)]
  assert.deepEqual(pickNearest(partners, BASE.lat, BASE.lng, 3).map((p) => p.id), ['d', 'a', 'b'])
})

test('다시 고르기 원: 등록 못 한 첫 업체 반경에 닿기 전, 150m~1km', () => {
  // 20번째 업체가 400m → 400 - 100 = 300m
  const many = Array.from({ length: 25 }, (_, i) => partner(`p${String(i).padStart(2, '0')}`, i < 19 ? 50 : 400))
  assert.equal(Math.round(reselectRadius(many, BASE.lat, BASE.lng)), 300)
  // 밀집: 20번째가 120m → 150m 로 올림
  const dense = Array.from({ length: 25 }, (_, i) => partner(`d${String(i).padStart(2, '0')}`, 120))
  assert.equal(reselectRadius(dense, BASE.lat, BASE.lng), 150)
  // 업체가 19곳 이하 → 1km
  assert.equal(reselectRadius(many.slice(0, 10), BASE.lat, BASE.lng), 1000)
})

test('내 주변 제휴: 반경 밖은 빼고 가까운 순', () => {
  const partners = [partner('far', 900), partner('near', 120), partner('mid', 480)]
  const result = partnersNear(partners, BASE.lat, BASE.lng, 500, 10)
  assert.deepEqual(result.map((r) => r.partner.id), ['near', 'mid'])
  assert.ok(Math.abs(result[0].meters - 120) < 1)
})

test('거리 표시', () => {
  assert.equal(formatDistance(3), '10m')
  assert.equal(formatDistance(124), '120m')
  assert.equal(formatDistance(999), '1000m')
  assert.equal(formatDistance(1234), '1.2km')
})

test('머무름: 3분 안 재진입은 처음 들어온 때부터', () => {
  const entered = kst(12, 0)
  const exited = kst(12, 2)
  const stay: StayRecord = { enteredAt: entered, exitedAt: exited }
  assert.equal(stayStartedAt(stay, exited + REENTRY_GRACE_MS), entered)
  assert.equal(stayStartedAt(stay, exited + REENTRY_GRACE_MS + 1), exited + REENTRY_GRACE_MS + 1)
  assert.equal(stayStartedAt({ enteredAt: entered, exitedAt: null }, kst(12, 3)), kst(12, 3))
  assert.equal(stayStartedAt(null, entered), entered)
})

test('진입 판단: 5분 뒤 예약, 밤·새벽에도 보낸다', () => {
  assert.deepEqual(decideOnEnter('a', NOON, [], NOON), { schedule: true, fireAt: NOON + DWELL_MS })
  // 시간대 제한은 10-29 에 없앴다.
  assert.equal(decideOnEnter('a', kst(22, 0), [], kst(22, 0)).schedule, true)
  assert.equal(decideOnEnter('a', kst(2, 0), [], kst(2, 0)).schedule, true)
  // 재진입으로 머무름이 이미 5분을 넘었으면 바로.
  assert.deepEqual(decideOnEnter('a', NOON - 10 * 60_000, [], NOON), { schedule: true, fireAt: NOON })
})

test('진입 판단: 업체당 하루 1번, 전체 하루 3번', () => {
  assert.deepEqual(decideOnEnter('a', NOON, [{ partnerId: 'a', at: kst(9, 0) }], NOON), {
    schedule: false,
    reason: 'partnerToday',
  })
  // 어제 보낸 건 세지 않는다.
  assert.equal(decideOnEnter('a', NOON, [{ partnerId: 'a', at: kst(12, 0, 26) }], NOON).schedule, true)
  const two = [
    { partnerId: 'x', at: kst(8, 40) },
    { partnerId: 'y', at: kst(9, 50) },
  ]
  assert.equal(decideOnEnter('a', NOON, two, NOON).schedule, true)
  const three = [...two, { partnerId: 'z', at: kst(10, 50) }]
  assert.deepEqual(decideOnEnter('a', NOON, three, NOON), { schedule: false, reason: 'dailyLimit' })
})

test('진입 판단: 알림 사이 최소 30분', () => {
  const sent = [{ partnerId: 'x', at: kst(11, 40) }]
  assert.deepEqual(decideOnEnter('a', kst(11, 50), sent, kst(11, 50)), { schedule: false, reason: 'tooSoon' })
  // 11:45 진입 → 11:50 에 뜨면 10분 차이, 12:06 진입 → 12:11 이면 31분.
  assert.equal(decideOnEnter('a', kst(12, 6), sent, kst(12, 6)).schedule, true)
})

test('등록할 때 이미 반경 안: 가만히 있어도 진입으로 처리할 업체', () => {
  // 경계(정확히 100m)는 안으로 친다.
  const regions = [partner('in', 60), partner('edge', 99.9), partner('out', 140)]
  assert.deepEqual(insideAtRegistration(regions, BASE.lat, BASE.lng).map((p) => p.id), ['in', 'edge'])
})

test('여러 곳이 겹치면 가장 오래 머문 곳 하나 + 나머지, 오늘 알린 곳은 뺀다', () => {
  const stays = new Map<string, StayRecord>([
    ['late', { enteredAt: kst(12, 3), exitedAt: null }],
    ['early', { enteredAt: kst(12, 0), exitedAt: null }],
    ['left', { enteredAt: kst(11, 0), exitedAt: kst(11, 30) }],
    ['done', { enteredAt: kst(11, 59), exitedAt: null }],
  ])
  const sent = [{ partnerId: 'done', at: kst(9, 0) }]
  assert.deepEqual(alertGroup(stays, sent, kst(12, 5)), { leadId: 'early', others: ['late'] })
  assert.equal(alertGroup(new Map(), [], NOON), null)
})

test('알림 문구: ○○에 계신가요?, 수신 거부, 소속 혜택, 길이 자르기, 더 있는 곳', () => {
  const p = partner('a', 0, {
    name: '홍익카페',
    affiliationBenefits: [{ affiliation: '미술대학', benefit: '미대생 아메리카노 1+1' }],
  })
  assert.deepEqual(nearbyAlertContent(p, null), {
    title: '홍익카페에 계신가요?',
    body: '제휴 혜택: 음료 10% 할인\n알림 끄기: 설정 > 근처 제휴 알림',
  })
  assert.ok(!nearbyAlertContent(p, null)!.title.includes('광고'))
  assert.match(nearbyAlertContent(p, '미술대학')!.body, /^제휴 혜택: 미대생 아메리카노 1\+1\n/)
  assert.match(nearbyAlertContent(p, null, 2)!.body, /\n근처에 제휴업체 2곳이 더 있어요\n/)

  const long = partner('b', 0, { benefit: '가'.repeat(80) })
  const firstLine = nearbyAlertContent(long, null)!.body.split('\n')[0]
  assert.equal(Array.from(firstLine.replace('제휴 혜택: ', '')).length, 60)
  assert.ok(firstLine.endsWith('…'))

  assert.equal(nearbyAlertContent(partner('c', 0, { benefit: '  ' }), null), null)
  // 내 소속 제휴가 아니면(현장 테스트) 소속을 앞에 붙인다.
  const liberal = partner('d', 0, { affiliations: ['문과대학'] })
  assert.match(nearbyAlertContent(liberal, null)!.body, /^\(문과대학 제휴\) 제휴 혜택: /)
  assert.match(nearbyAlertContent(liberal, '문과대학')!.body, /^제휴 혜택: /)
})
