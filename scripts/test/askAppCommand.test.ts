import assert from 'node:assert/strict'
import { test } from 'node:test'

import { newsSearchQuery, parseAskAppCommand } from '../../src/utils/askAppCommand'

const ids = (text: string) => {
  const command = parseAskAppCommand(text)
  return command && 'boards' in command ? command.boards.map((b) => b.id) : null
}

// 11-09 운영진: '화학공학과 구독해줘' 같은 말은 앱이 알아듣고 확인 카드를 띄운다(바꾸는 건 버튼을 눌러야).
test('board subscribe and unsubscribe by department name', () => {
  assert.deepEqual(parseAskAppCommand('화학공학과 구독해줘')?.kind, 'subscribe')
  assert.deepEqual(ids('화학공학과 구독해줘'), ['화학공학전공'])
  assert.deepEqual(ids('컴퓨터공학과 구독 좀'), ['컴퓨터공학과'])
  const off = parseAskAppCommand('컴퓨터공학과 구독 취소해줘')
  assert.equal(off?.kind, 'subscribe')
  assert.equal(off && 'on' in off ? off.on : null, false)
})

test('alerts: all, category, one board', () => {
  assert.deepEqual(parseAskAppCommand('알림 꺼줘'), { kind: 'alertAll', on: false })
  assert.deepEqual(parseAskAppCommand('알림 다시 켜줘'), { kind: 'alertAll', on: true })
  assert.deepEqual(parseAskAppCommand('장학 알림 켜줘'), { kind: 'alertCategory', on: true, category: '장학' })
  assert.equal(parseAskAppCommand('화학공학과 알림 꺼줘')?.kind, 'boardAlert')
})

test('how-to questions open the settings screen instead of changing anything', () => {
  assert.deepEqual(parseAskAppCommand('알림 설정 어떻게 해?'), { kind: 'open', screen: 'alerts' })
  assert.deepEqual(parseAskAppCommand('알림 켜는 법'), { kind: 'open', screen: 'alerts' })
  assert.deepEqual(parseAskAppCommand('게시판 구독 어떻게 해'), { kind: 'open', screen: 'subscriptions' })
})

test('other questions go to the server as before', () => {
  assert.equal(parseAskAppCommand('휴학 신청 어떻게 해'), null)
  assert.equal(parseAskAppCommand('알림이 안 와요'), null)
  assert.equal(parseAskAppCommand('수강신청 알림 문자 언제 와'), null)
  assert.equal(parseAskAppCommand('없는학과 구독해줘'), null)
})

test('notice search phrase becomes a news search query', () => {
  assert.equal(newsSearchQuery('지금 공지사항에 있는 장학금 신청 찾아줘'), '장학금 신청')
  assert.equal(newsSearchQuery('국가장학금 공지 찾아줘'), '국가장학금')
  assert.equal(newsSearchQuery('공지사항에서 교환학생 검색해줘'), '교환학생')
  assert.equal(newsSearchQuery('장학금 언제 들어와'), null)
  assert.equal(newsSearchQuery('공지 찾아줘'), null)
})
