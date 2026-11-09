import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ALL_ASK_FLOWS } from '../../src/utils/officeAsk'

// 되묻기 버튼·이어 묻기 버튼이 가리키는 단계가 모두 있어야 한다. 'flow/node' 는 다른 안내로 넘어가는 버튼(주제표 see).
test('every option and follow-up points at an existing step', () => {
  const missing: string[] = []
  for (const flow of ALL_ASK_FLOWS) {
    for (const [nodeId, node] of Object.entries(flow.nodes)) {
      const options = node.kind === 'question' ? node.options : (node.followUps ?? [])
      for (const { next } of options) {
        const slash = next.indexOf('/')
        const target = slash < 0 ? flow : ALL_ASK_FLOWS.find((item) => item.id === next.slice(0, slash))
        if (!target?.nodes[slash < 0 ? next : next.slice(slash + 1)]) missing.push(`${flow.id}/${nodeId} → ${next}`)
      }
    }
  }
  assert.deepEqual(missing, [])
})
