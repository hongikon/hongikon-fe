import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backendNewsId, emptyBodyMessage, originalLinkLabels } from '../../src/utils/news/detail'

test('숫자 문자열 id 만 백엔드 소식', () => {
  assert.equal(backendNewsId('123'), 123)
  assert.equal(backendNewsId('n1'), null)
  assert.equal(backendNewsId(''), null)
  assert.equal(backendNewsId('12a'), null)
})

test('원문 링크가 없으면 학교 홈페이지라고 적는다', () => {
  assert.deepEqual(originalLinkLabels('https://x'), { label: '원문 보기', a11yLabel: '원문 보기' })
  assert.deepEqual(originalLinkLabels(undefined), {
    label: '원문 보기 (홍익대 홈페이지)',
    a11yLabel: '원문 보기, 홍익대 홈페이지',
  })
  assert.equal(originalLinkLabels('').label, '원문 보기 (홍익대 홈페이지)')
})

test('빈 본문 안내는 이미지가 있으면 이미지 문구', () => {
  assert.equal(emptyBodyMessage(2), '본문이 이미지로만 되어 있어요. 원문에서 확인해 주세요.')
  assert.equal(emptyBodyMessage(0), '본문 미리보기가 없어요. 원문에서 확인해 주세요.')
  assert.equal(emptyBodyMessage(undefined), '본문 미리보기가 없어요. 원문에서 확인해 주세요.')
})
