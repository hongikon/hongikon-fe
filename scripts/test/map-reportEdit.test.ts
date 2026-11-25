import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ApiError, NetworkError } from '../../src/apis/client'
import { acceptEditPhotos, formatEditFloor, initialEditPhotos, saveErrorMessage, stepFloor } from '../../src/utils/map/report/reportEdit'

;(globalThis as { __DEV__?: boolean }).__DEV__ = false

test('층 한 칸: 0층은 건너뛰고 B10~30F 안', () => {
  assert.equal(stepFloor(1, -1), -1)
  assert.equal(stepFloor(-1, 1), 1)
  assert.equal(stepFloor(30, 1), 30)
  assert.equal(stepFloor(-10, -1), -10)
  assert.equal(formatEditFloor(-2), 'B2')
  assert.equal(formatEditFloor(3), '3F')
  assert.equal(formatEditFloor(0), 'L')
})

test('처음 사진 칸은 서버 번호를 지키고 null 은 건너뛴다', () => {
  assert.deepEqual(initialEditPhotos({ imageUrls: ['a', null, 'c'] } as never, 3), [
    { kind: 'existing', index: 0, url: 'a' },
    { kind: 'existing', index: 2, url: 'c' },
  ])
  assert.deepEqual(initialEditPhotos({ imageUrl: 'x' } as never, 3), [{ kind: 'existing', index: 0, url: 'x' }])
  assert.deepEqual(initialEditPhotos({} as never, 3), [])
})

test('새 사진 거르기', () => {
  const { accepted, rejected } = acceptEditPhotos(
    [{ uri: 'a.jpg' }, { uri: 'b.gif', mimeType: 'image/gif' }, { uri: 'c.png' }, { uri: 'd.png' }],
    2,
  )
  assert.deepEqual(accepted.map((p) => (p.kind === 'new' ? p.picked.uri : '')), ['a.jpg', 'c.png'])
  assert.equal(rejected, 1)
})

test('저장 실패 문구', () => {
  assert.match(saveErrorMessage(new NetworkError('offline')), /인터넷 연결/)
  assert.equal(saveErrorMessage(new ApiError(404, 'x', undefined, '없음')), '이미 지워진 제보예요.')
  assert.match(saveErrorMessage(new ApiError(405, 'x')), /아직 제보 수정/)
  assert.equal(saveErrorMessage(new ApiError(400, 'x', undefined, '제목이 길어요')), '제목이 길어요')
  assert.match(saveErrorMessage(new ApiError(500, 'x')), /서버에 일시적인/)
})
