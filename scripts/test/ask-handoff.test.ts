import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ChatMessage } from '../../src/utils/ask/chatTypes'
import { feedbackRef, handoffAfterFeedback, handoffContent, isContactValid } from '../../src/utils/ask/handoff'
import { boardCommandVerb, commandText } from '../../src/utils/ask/appCommandText'

const feedback = (patch: Partial<Extract<ChatMessage, { role: 'feedback' }>> = {}): Extract<ChatMessage, { role: 'feedback' }> => ({
  id: 10,
  role: 'feedback',
  question: '질문',
  resolved: null,
  ...patch,
})

test('feedbackRef: 서버 기록이 먼저, 흐름 답은 clientId', () => {
  assert.equal(feedbackRef(feedback({ logId: 3 })), 'route:3')
  assert.equal(feedbackRef(feedback({ flowRef: { flowId: 'a', nodeId: 'b' }, clientId: 'c1' })), 'flow:c1')
  assert.equal(feedbackRef(feedback()), null)
})

test('handoffAfterFeedback: 바로 위 서버 답의 글·근거를 담는다', () => {
  const messages: ChatMessage[] = [
    {
      id: 5,
      role: 'reply',
      text: '서버 답',
      found: true,
      sources: [{ flowId: 'x', nodeId: 'y' }],
      links: [],
      buttons: null,
      appActions: [],
      question: '질문',
      streaming: false,
      status: '',
      stopped: false,
      logId: 9,
      steps: [],
      stepsOpen: false,
      sections: null,
      moreOpen: false,
    },
    feedback({ logId: 9 }),
  ]
  const { handoff, phone } = handoffAfterFeedback(messages, messages[1] as Extract<ChatMessage, { role: 'feedback' }>)
  assert.equal(phone, undefined)
  assert.equal(handoff.role, 'handoff')
  if (handoff.role === 'handoff') {
    assert.equal(handoff.answer, '서버 답')
    assert.deepEqual(handoff.sources, ['x/y'])
    assert.equal(handoff.askRef, 'route:9')
    assert.equal(handoff.status, 'editing')
  }
})

test('handoffContent: 1000자 안, 답은 350자에서 자른다', () => {
  const text = handoffContent({ question: 'q', answer: ' a  b '.repeat(200), sources: ['f/n'], note: ' ' })
  const lines = text.split('\n')
  assert.equal(lines[0], '[물어보기에서 넘어온 문의]')
  assert.equal(lines[1], '질문: q')
  assert.ok(lines[2].startsWith('홍익온 답: a b'))
  assert.ok(lines[2].endsWith('…'))
  assert.equal(lines[3], '근거: f/n')
  assert.equal(lines[4], '더 알고 싶은 점: (없음)')
  assert.ok(handoffContent({ question: 'q', answer: '', sources: [], note: 'n'.repeat(2000) }).length <= 1000)
})

test('isContactValid', () => {
  assert.equal(isContactValid(''), true)
  assert.equal(isContactValid('a@b.co'), true)
  assert.equal(isContactValid('a@b'), false)
  assert.equal(isContactValid('a b@c.d'), false)
})

test('commandText·boardCommandVerb', () => {
  assert.equal(commandText({ kind: 'alertAll', on: true }), '앱 알림을 다시 켤까요?')
  assert.equal(commandText({ kind: 'open', screen: 'subscriptions' }).startsWith('게시판 구독은'), true)
  assert.equal(boardCommandVerb({ kind: 'subscribe', on: false, boards: [] }), '구독 해제')
  assert.equal(boardCommandVerb({ kind: 'boardAlert', on: true, boards: [] }), '알림 켜기')
})
