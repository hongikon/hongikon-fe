import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDownwardDrag, shouldCloseOnPull, shouldCloseOnRelease } from '../../src/utils/news/searchGestures'

test('아래로, 세로가 확실할 때만 머리 카드를 잡는다', () => {
  assert.equal(isDownwardDrag(0, 9), true)
  assert.equal(isDownwardDrag(0, 8), false)
  assert.equal(isDownwardDrag(0, -20), false)
  assert.equal(isDownwardDrag(10, 14), false)
  assert.equal(isDownwardDrag(10, 16), true)
})

test('120 넘게 내렸거나 0.9 넘게 튕기면 닫는다', () => {
  assert.equal(shouldCloseOnRelease(121, 0), true)
  assert.equal(shouldCloseOnRelease(120, 0.9), false)
  assert.equal(shouldCloseOnRelease(10, 1), true)
})

test('목록 바운스 닫기는 iOS 에서 70 넘게 당겼을 때만', () => {
  assert.equal(shouldCloseOnPull('ios', -71), true)
  assert.equal(shouldCloseOnPull('ios', -70), false)
  assert.equal(shouldCloseOnPull('android', -200), false)
  assert.equal(shouldCloseOnPull('web', -200), false)
})
