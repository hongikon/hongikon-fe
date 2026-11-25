import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ALL_ASK_FLOWS } from '../../src/utils/ask/officeAsk'
import type { ChatMessage } from '../../src/utils/ask/chatTypes'
import {
  findStep,
  followTarget,
  lastUserText,
  randomId,
  recentTurns,
  replyButtons,
  sourceLinks,
  stepMessages,
} from '../../src/utils/ask/conversation'
import { appendStep, askFailureText, stepInfo } from '../../src/utils/ask/streamStatus'
import { ApiError } from '../../src/apis/client'
import { placeName, facilityPlaceLine } from '../../src/utils/ask/places'
import type { Building, Facility, Partner } from '../../src/types'

;(globalThis as { __DEV__?: boolean }).__DEV__ = false

const answerStep = (() => {
  for (const flow of ALL_ASK_FLOWS) {
    for (const [nodeId, node] of Object.entries(flow.nodes)) if (node.kind === 'answer' && node.links?.length) return { flow, nodeId, node }
  }
  throw new Error('답 단계가 없다')
})()

const reply = (patch: Partial<Extract<ChatMessage, { role: 'reply' }>> = {}): Extract<ChatMessage, { role: 'reply' }> => ({
  id: 1,
  role: 'reply',
  text: '답',
  found: true,
  sources: [],
  links: [],
  buttons: null,
  appActions: [],
  question: '질문',
  streaming: false,
  status: '',
  stopped: false,
  logId: null,
  steps: [],
  stepsOpen: false,
  sections: null,
  moreOpen: false,
  ...patch,
})

test('findStep: 아는 흐름/단계만', () => {
  assert.deepEqual(findStep(`${answerStep.flow.id}/${answerStep.nodeId}`), { flowId: answerStep.flow.id, nodeId: answerStep.nodeId })
  assert.equal(findStep('none'), null)
  assert.equal(findStep('gone/start'), null)
})

test('stepMessages: 끝 답이면 답 + 해결됐나요, 모르면 안내 실패 한 줄', () => {
  const out = stepMessages(answerStep.flow.id, answerStep.nodeId, '질문', true, 7)
  assert.equal(out.length, 2)
  assert.equal(out[0].role, 'answer')
  assert.equal(out[1].role, 'feedback')
  if (out[1].role === 'feedback') {
    assert.equal(out[1].logId, 7)
    assert.deepEqual(out[1].flowRef, { flowId: answerStep.flow.id, nodeId: answerStep.nodeId })
    assert.ok(out[1].clientId)
  }
  assert.deepEqual(stepMessages('gone', 'x', 'q'), [{ role: 'text', text: '안내를 불러오지 못했어요. 다시 물어봐 주세요.' }])
})

test('recentTurns: 최근 3턴, 안내 id·답을 붙인다', () => {
  const messages: ChatMessage[] = [
    { id: 1, role: 'user', text: 'a' },
    { id: 2, role: 'user', text: 'b' },
    { id: 3, role: 'user', text: 'c' },
    reply({ id: 4, text: 'x'.repeat(1200), sources: [{ flowId: 'f', nodeId: 'n' }] }),
    { id: 5, role: 'user', text: 'd'.repeat(300) },
  ]
  const turns = recentTurns(messages)
  assert.equal(turns.length, 3)
  assert.equal(turns[0].question, 'b')
  assert.equal(turns[1].nodeId, 'f/n')
  assert.equal(turns[1].answer?.length, 1000)
  assert.equal(turns[2].question.length, 200)
})

test('followTarget·lastUserText', () => {
  assert.deepEqual(followTarget('a', 'next'), { flowId: 'a', nodeId: 'next' })
  assert.deepEqual(followTarget('a', 'b/start'), { flowId: 'b', nodeId: 'start' })
  assert.equal(lastUserText([{ id: 1, role: 'user', text: '처음' }, { id: 2, role: 'user', text: '나중' }], 'x'), '나중')
  assert.equal(lastUserText([], 'x'), 'x')
})

test('sourceLinks: 같은 페이지는 한 줄, 학식은 menu', () => {
  const step = { flowId: answerStep.flow.id, nodeId: answerStep.nodeId }
  const links = sourceLinks({
    sources: [step, step],
    links: [
      { title: '학식 11-19', url: null, date: '11-19' },
      { title: '공지', url: 'https://x', date: null },
      { title: '공지', url: 'https://x', date: null },
    ],
  })
  assert.equal(links.length, 3)
  assert.equal(links[0].kind, 'page')
  assert.equal(links[1].kind, 'menu')
  assert.equal(links[2].kind, 'notice')
})

test('replyButtons: 서버 버튼이 먼저, 흘러나오는 중엔 링크 없음', () => {
  const served = replyButtons(
    reply({
      buttons: { pages: [{ title: 'P', url: 'https://p' }], phones: [{ label: 'L', phone: '1' }], facilityId: 'f1' },
      links: [{ title: 'N', url: 'https://n', date: '11-01' }, { title: 'no url', url: null, date: null }],
    }),
  )
  assert.deepEqual(served.phones, [{ label: 'L', phone: '1' }])
  assert.equal(served.place, 'f1')
  assert.deepEqual(served.links.map((l) => l.key), ['https://p', 'https://n'])
  const streaming = replyButtons(reply({ streaming: true, sources: [{ flowId: answerStep.flow.id, nodeId: answerStep.nodeId }] }))
  assert.deepEqual(streaming.links, [])
  const old = replyButtons(reply({ sources: [{ flowId: answerStep.flow.id, nodeId: answerStep.nodeId }] }))
  assert.equal(old.links[0]?.url, answerStep.node.links?.[0].url)
})

test('stepInfo·appendStep: 쉬운 말, 잇따른 같은 과정은 한 번', () => {
  assert.deepEqual(stepInfo({ event: 'writing', data: {} } as never), { status: '답을 정리하고 있어요', step: '답 정리' })
  assert.equal(stepInfo({ event: 'delta', data: { text: 'x' } } as never), null)
  assert.deepEqual(appendStep(['a'], 'a'), ['a'])
  assert.deepEqual(appendStep(['a'], 'b'), ['a', 'b'])
  const same = ['a']
  assert.equal(appendStep(same, null), same)
})

test('askFailureText: 상태 코드별 문구, 앱 탭은 서버 한도 문구', () => {
  assert.equal(askFailureText(new ApiError(429, 'x', undefined, '오늘 한도'), true), '오늘 한도')
  assert.equal(askFailureText(new ApiError(429, 'x'), false), '질문이 많아 잠시 쉬고 있어요. 조금 뒤에 다시 물어봐 주세요.')
  assert.equal(askFailureText(new ApiError(403, 'x'), true), '로그인하면 물어볼 수 있어요.')
  assert.equal(askFailureText(new ApiError(404, 'x'), true), '지금은 물어보기 서버가 꺼져 있어 답할 수 없어요.')
  assert.equal(askFailureText(new Error('net'), true), '지금은 답을 만들 수 없어요. 잠시 뒤에 다시 물어봐 주세요.')
})

test('placeName·facilityPlaceLine: 지도 데이터에 있는 곳만', () => {
  const data = {
    buildings: [{ code: 'K', name: 'K동' } as Building],
    partners: [{ id: 'p1', name: '카페' } as Partner],
    facilities: [{ id: 'f1', note: '학생지원팀', buildingName: '학생회관', floor: 2 } as Facility],
  }
  assert.equal(placeName('building:K', data), 'K동')
  assert.equal(placeName('partner:p1', data), '카페')
  assert.equal(placeName('facility:f1', data), '학생지원팀 · 학생회관')
  assert.equal(placeName('building:X', data), null)
  assert.equal(placeName('etc:1', data), null)
  assert.ok(facilityPlaceLine(data.facilities, 'f1')?.startsWith('학생지원팀 · 학생회관 '))
  assert.equal(facilityPlaceLine(data.facilities, 'none'), null)
})

test('randomId: 매번 다르다', () => {
  assert.notEqual(randomId('c'), randomId('c'))
})
