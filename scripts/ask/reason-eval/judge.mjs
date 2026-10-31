// answers-<label>.json 을 학교 공식 정답(verdict)과 비교해 Opus 5.5 로 채점한다.
// 사용: node judge.mjs <label>...
import { readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

const client = new Anthropic()
const cases = Object.fromEntries(
  JSON.parse(readFileSync(new URL('../cases-reason/reason.json', import.meta.url), 'utf8')).map((c) => [c.id, c]),
)

const Grade = z.object({
  conclusion: z.enum(['correct', 'partial', 'wrong', 'no_answer']),
  key_facts_covered: z.number().int(),
  key_facts_total: z.number().int(),
  harmful_error: z.boolean(),
  clarify_handled: z.enum(['yes', 'no', 'not_needed']),
  note: z.string(),
})

const SYSTEM = `너는 대학 학사 안내 챗봇의 답을 채점한다. 기준은 [공식 정답]이다(학교 FAQ·공지 Q&A에서 가져온 것).
- conclusion: 학생 질문에 대한 결론(된다/안 된다/조건·순서/결과)이 공식 정답과 같으면 correct, 결론은 맞지만 중요한 조건·결과가 빠졌으면 partial, 결론이 다르거나 틀린 사실로 결론을 냈으면 wrong, 답을 못 했으면("확인되지 않아요" 등) no_answer.
- key_facts_*: 공식 정답의 핵심 사실(숫자·조건·순서·결과)을 스스로 나눠 세고, 답에 맞게 들어간 수를 센다. 표현이 달라도 뜻이 같으면 인정.
- harmful_error: 학생이 그대로 따르면 손해(제적·삭제·환불 손실·기한 놓침)를 볼 수 있는 틀린 말이 있으면 true.
- clarify_handled: [되묻기 필요]가 true 인 문항에서 상황을 되묻거나 경우를 나눠 답했으면 yes, 아니면 no. false 인 문항은 not_needed.
- 공식 정답에 없는 내용은 틀린 게 아니면 감점하지 않는다. 답 길이·말투는 채점하지 않는다.
- note: 한국어 한 문장으로 무엇이 맞고 빠졌는지.`

async function grade(answer) {
  const c = cases[answer.id]
  const prompt = `[질문]\n${c.q}\n\n[공식 정답]\n${c.verdict}\n(근거: ${c.src})\n\n[되묻기 필요]\n${c.clarify}\n\n[챗봇 답]\n${answer.ok ? answer.text : '(오류로 답 없음)'}`
  const res = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: zodOutputFormat(Grade) },
    messages: [{ role: 'user', content: prompt }],
  })
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error(`${answer.id}: ${res.stop_reason}`)
  return { id: answer.id, ...res.parsed_output, usage: res.usage }
}

for (const label of process.argv.slice(2)) {
  const answers = JSON.parse(readFileSync(`answers-${label}.json`, 'utf8'))
  const grades = []
  let next = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < answers.length) {
      const a = answers[next++]
      grades.push(await grade(a))
    }
  }))
  grades.sort((a, b) => a.id.localeCompare(b.id))
  writeFileSync(`grades-${label}.json`, JSON.stringify(grades, null, 1))
  const n = (k, v) => grades.filter((g) => g[k] === v).length
  const facts = grades.reduce((s, g) => s + g.key_facts_covered, 0) / grades.reduce((s, g) => s + g.key_facts_total, 0)
  console.log(`${label}: correct ${n('conclusion', 'correct')} partial ${n('conclusion', 'partial')} wrong ${n('conclusion', 'wrong')} no_answer ${n('conclusion', 'no_answer')} | facts ${(facts * 100).toFixed(0)}% | harmful ${n('harmful_error', true)} | clarify ${n('clarify_handled', 'yes')}/${grades.filter((g) => g.clarify_handled !== 'not_needed').length}`)
}
