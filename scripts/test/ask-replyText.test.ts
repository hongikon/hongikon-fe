import assert from 'node:assert/strict'
import { test } from 'node:test'

import { briefSections, firstSentence, parseReply, splitItemLabel } from '../../src/utils/ask/replyText'

test('firstSentence: 굵게 표시를 떼고 첫 문장만, 90자까지', () => {
  assert.equal(firstSentence(undefined), undefined)
  assert.equal(firstSentence(''), undefined)
  assert.equal(firstSentence('**학생회관** 2층이에요. 평일만 열어요.'), '학생회관 2층이에요.')
  assert.equal(firstSentence('첫 줄\n둘째 줄'), '첫 줄')
  assert.equal(firstSentence('마침표 없는 글'), '마침표 없는 글')
  const long = '가'.repeat(120)
  const cut = firstSentence(long)!
  assert.equal(cut.length, 90)
  assert.ok(cut.endsWith('…'))
})

test('parseReply: 요약·소제목·항목·끝 문장으로 나눈다', () => {
  const parsed = parseReply('휴학은 학기 전에 신청해요.\n[준비물]\n- 신청서\n- 신분증\n[순서]\n1. 접수\n2) 승인\n궁금하면 물어보세요.')
  assert.equal(parsed.lead, '휴학은 학기 전에 신청해요.')
  assert.deepEqual(parsed.sections, [
    { title: '준비물', items: ['신청서', '신분증'] },
    { title: '순서', items: ['접수', '승인'], ordered: true },
  ])
  assert.equal(parsed.tail, '궁금하면 물어보세요.')
})

test('parseReply: 소제목이 다시 나오면 앞 끝 문장은 버리고, 소제목 없는 항목은 빈 제목 묶음', () => {
  const parsed = parseReply('- 하나\n중간 말\n[다음]\n- 둘')
  assert.equal(parsed.lead, '')
  assert.deepEqual(parsed.sections, [
    { title: '', items: ['하나'] },
    { title: '다음', items: ['둘'] },
  ])
  assert.equal(parsed.tail, '')
})

test('briefSections: 소제목 3개·항목 8개까지, 같은 소제목은 뺀다, full 은 통째로', () => {
  const many = Array.from({ length: 6 }, (_, i) => `항목${i}`)
  const { shown, cut } = briefSections([
    { title: '팁', items: many, full: true },
    { title: 'A', items: many },
    { title: 'A', items: ['겹침'] },
    { title: 'B', items: many },
    { title: 'C', items: ['c'] },
  ])
  assert.equal(cut, true)
  assert.deepEqual(shown.map((s) => s.title), ['팁', 'A', 'B'])
  assert.equal(shown[0].items?.length, 6)
  assert.equal(shown[1].items?.length, 4)
  assert.equal(shown[2].items?.length, 4)
  assert.deepEqual(briefSections(undefined), { shown: [], cut: false })
  assert.equal(briefSections([{ title: 'A', items: ['a'] }]).cut, false)
})

test('briefSections: 표는 8줄까지', () => {
  const rows = Array.from({ length: 10 }, (_, i) => [`${i}`])
  const { shown, cut } = briefSections([{ title: '표', table: { head: ['n'], rows } }])
  assert.equal(cut, true)
  assert.equal(shown[0].table?.rows.length, 8)
})

test('splitItemLabel: 짧은 라벨만 나눈다', () => {
  assert.deepEqual(splitItemLabel('자격·조건: 재학생'), ['자격·조건', '재학생'])
  assert.deepEqual(splitItemLabel('기간： 3월'), ['기간', '3월'])
  assert.equal(splitItemLabel('시간 10:30 까지'), null)
  assert.equal(splitItemLabel('아주아주아주아주아주아주긴라벨입니다: 내용'), null)
})
