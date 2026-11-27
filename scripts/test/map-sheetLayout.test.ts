import { test } from 'node:test'
import assert from 'node:assert/strict'
import { settleLayoutSize } from '../../src/utils/map/sheetLayout'

test('처음 잰 높이는 정수 dp 로 올려 쓴다', () => {
  assert.equal(settleLayoutSize(null, 104.36), 105)
  assert.equal(settleLayoutSize(null, 110), 110)
})

test('1~2dp 안에서 오락가락하면 이전 값을 그대로 둔다(갤럭시 시트 떨림)', () => {
  let h = settleLayoutSize(null, 104.36)
  for (const measured of [105.4, 104.2, 105.7, 103.9, 104.8]) h = settleLayoutSize(h, measured)
  assert.equal(h, 105)
})

test('내용이 실제로 바뀌면(2dp 넘게) 새 높이를 쓴다', () => {
  assert.equal(settleLayoutSize(105, 180.2), 181)
  assert.equal(settleLayoutSize(181, 96), 96)
})
