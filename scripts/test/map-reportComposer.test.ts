import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ApiError, NetworkError } from '../../src/apis/client'
import {
  composerMissingFields,
  filterPickedAssets,
  formatFloor,
  isPhotoRejection,
  pickedAssetsError,
  reportSubmitErrorMessage,
} from '../../src/utils/map/reportComposer'

// ApiError 생성자가 __DEV__ 를 읽는다(RN 전역).
;(globalThis as { __DEV__?: boolean }).__DEV__ = false

const BASE = {
  hasBuilding: true,
  offCampus: false,
  shownPlace: 'T동 근처',
  customInputOpen: false,
  customLabelDraft: '',
  trimmedTitle: '간식행사',
  scheduleProblem: null,
}

test('층 표시: 지상 3F, 지하 B1', () => {
  assert.equal(formatFloor(false, 3), '3F')
  assert.equal(formatFloor(true, 1), 'B1')
})

test('빠진 필수 항목은 화면 순서(건물 → 카테고리 → 제목 → 시간)', () => {
  assert.deepEqual(composerMissingFields(BASE), [])
  const all = composerMissingFields({
    ...BASE,
    hasBuilding: false,
    customInputOpen: true,
    trimmedTitle: '',
    scheduleProblem: '끝 시각이 시작보다 빨라요.',
  })
  assert.deepEqual(all.map((item) => item.field), ['building', 'category', 'title', 'schedule'])
  assert.equal(all[3].message, '끝 시각이 시작보다 빨라요.')
  assert.match(all[0].message, /2\.5km|km 안/)
})

test('캠퍼스 밖 핀은 장소를 비우면 빠진 것으로 본다', () => {
  const off = { ...BASE, hasBuilding: false, offCampus: true }
  assert.deepEqual(composerMissingFields(off), [])
  assert.equal(composerMissingFields({ ...off, shownPlace: '   ' })[0].field, 'building')
})

test('직접 입력 칸을 열어 두면 초안 유무로 안내가 다르다', () => {
  const empty = composerMissingFields({ ...BASE, customInputOpen: true })[0].message
  const drafted = composerMissingFields({ ...BASE, customInputOpen: true, customLabelDraft: '분실물' })[0].message
  assert.match(empty, /닫아 주세요/)
  assert.match(drafted, /확인 버튼/)
})

test('등록 실패 문구', () => {
  assert.match(reportSubmitErrorMessage(new NetworkError('offline')), /인터넷 연결/)
  assert.equal(reportSubmitErrorMessage(new ApiError(400, 'x', undefined, '시작 시각이 지났어요.')), '시작 시각이 지났어요.')
  assert.match(reportSubmitErrorMessage(new ApiError(400, 'x', undefined, '제목이 비었어요.')), /위치\(건물·층\)/)
  assert.equal(reportSubmitErrorMessage(new ApiError(429, 'x', undefined, '승인을 기다리는 제보가 3건 있어요.')), '승인을 기다리는 제보가 3건 있어요.')
  assert.match(reportSubmitErrorMessage(new ApiError(429, 'x')), /너무 자주/)
  assert.match(reportSubmitErrorMessage(new ApiError(503, 'x')), /서버에 일시적인/)
  assert.equal(reportSubmitErrorMessage(new Error('이 건물은 안 돼요')), '이 건물은 안 돼요')
  assert.match(reportSubmitErrorMessage('??'), /올리지 못했어요/)
})

test('사진 거절은 사진이 있고 400 이며 문구가 없거나 사진 이야기일 때만', () => {
  assert.equal(isPhotoRejection(new ApiError(400, 'x'), 1), true)
  assert.equal(isPhotoRejection(new ApiError(400, 'x', undefined, '사진을 확인하지 못했어요'), 2), true)
  assert.equal(isPhotoRejection(new ApiError(400, 'x', undefined, '제목이 비었어요'), 1), false)
  assert.equal(isPhotoRejection(new ApiError(400, 'x'), 0), false)
  assert.equal(isPhotoRejection(new ApiError(500, 'x'), 1), false)
})

test('고른 사진 거르기: 중복·형식·용량·남은 자리', () => {
  const result = filterPickedAssets(
    [
      { uri: 'a.jpg' },
      { uri: 'b.heic', mimeType: 'image/heic' },
      { uri: 'c.png', fileSize: 6 * 1024 * 1024 },
      { uri: 'd.jpg' },
      { uri: 'e.jpg' },
      { uri: 'f.jpg' },
    ],
    ['a.jpg'],
    2,
  )
  assert.deepEqual(result.accepted.map((item) => item.uri), ['d.jpg', 'e.jpg'])
  assert.equal(result.unsupported, 1)
  assert.equal(result.tooLarge, 1)
  assert.equal(result.overflow, 1)
  // 형식 문제가 먼저 보인다.
  assert.match(pickedAssetsError(result, false, 3) ?? '', /JPEG·PNG 가 아닌 사진 1장/)
  assert.equal(pickedAssetsError({ accepted: [], unsupported: 0, tooLarge: 0, overflow: 2 }, false, 3), '사진은 3장까지라 2장은 뺐어요.')
  assert.match(pickedAssetsError({ accepted: [], unsupported: 0, tooLarge: 1, overflow: 0 }, true, 3) ?? '', /5MB 이하/)
  assert.equal(pickedAssetsError({ accepted: [], unsupported: 0, tooLarge: 0, overflow: 0 }, true, 3), null)
})
