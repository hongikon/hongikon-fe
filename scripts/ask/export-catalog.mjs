// 물어보기 흐름(ALL_ASK_FLOWS)을 서버 LLM 용으로 내보낸다. 사용: node scripts/ask/export-catalog.mjs [출력 폴더]
// 기본 출력은 옆 백엔드 레포의 src/main/resources/ask/ 아래 두 파일.
//  - catalog.json: 고르는 데 쓰는 노드 요약(id·종류·요약·대표 낱말, 되묻기 단계는 버튼이 가리키는 안내 next). 서버가 질문에 맞는 안내 id 를 고른다.
//  - sources.json: 노드마다 안내 원문 전체(본문·섹션·표·전화·링크·확인일). 서버가 고른 안내의 원문만 주고 그 안에서만 답하게 한다.
//    meta 에는 답 카드 아래 버튼용 링크·전화·위치(지도 시설 id)를 따로 둔다 — 서버가 응답에 실어 보내, 버튼·링크 순서를 바꿀 때 앱 배포 없이 서버만 고치면 된다.
// 흐름·문구를 바꾸면 다시 돌리고 백엔드에도 같이 커밋한다(앱이 모르는 id 를 받으면 낱말 찾기로 돌아간다).
// 같은 입력이면 바이트까지 같은 파일이 나와야 한다 — 서버가 이 내용을 프롬프트 캐시 앞부분으로 쓴다.
import { register } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

register('./ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const { ALL_ASK_FLOWS } = await import('../../src/utils/officeAsk.ts')

const outDir = process.argv[2] ?? fileURLToPath(new URL('../../../hongikon-be/src/main/resources/ask/', import.meta.url))

/**
 * 요약 한 줄 길이와 노드마다 붙일 대표 낱말 수. 길수록 잘 고르지만 프롬프트(=캐시 쓰기 비용)가 커진다.
 * 지금 값으로 약 5만 토큰(10-15 측정). 요청이 10만 토큰을 넘으면 단가가 5배가 되니 그 아래로 둔다.
 * 답의 섹션 제목('안내, 구성, 담당정보' …)은 2만 토큰이 넘게 늘리면서 고르는 데 별 도움이 안 돼 뺐다.
 */
const TEXT_MAX = 80
const WORDS_MAX = 6

const clip = (text, max) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/** 안내 원문을 LLM 이 읽을 글로 옮긴다. 앱 화면에 보이는 내용(본문·섹션·표·전화·링크)을 빠짐없이, 지어 넣지 않고. */
const sourceText = (flow, node) => {
  const lines = []
  if (node.kind === 'question') {
    lines.push(`(되묻기) ${node.text}`, `고를 수 있는 것: ${node.options.map((option) => option.label).join(' / ')}`)
  } else {
    lines.push(node.text)
    for (const section of node.sections ?? []) {
      lines.push(`[${section.title}]`)
      if (section.table) for (const row of [section.table.head, ...section.table.rows]) lines.push(row.join(' | '))
      for (const [index, item] of (section.items ?? []).entries()) lines.push(`${section.ordered ? `${index + 1}.` : '-'} ${item}`)
    }
    for (const phone of node.phones ?? []) lines.push(`전화: ${phone.label} ${phone.phone}`)
    for (const link of node.links ?? []) lines.push(`링크: ${link.label} ${link.url}`)
  }
  lines.push(`(확인 ${flow.checkedAt})`)
  return lines.join('\n')
}

const entries = []
const sources = {}
const meta = {}
for (const flow of ALL_ASK_FLOWS) {
  for (const [nodeId, node] of Object.entries(flow.nodes)) {
    // 이 노드로 바로 들어오는 길의 낱말(묶음마다 앞 낱말 둘). 질문을 어떤 말로 하는지 알려 주는 힌트다.
    const words = []
    for (const entry of flow.entries) {
      if (entry.node !== nodeId) continue
      for (const group of entry.match) for (const word of group.slice(0, 2)) if (!words.includes(word)) words.push(word)
    }
    const parts = [clip(node.text, TEXT_MAX)]
    if (node.kind === 'question') parts.push(`(되묻기: ${node.options.map((option) => option.label).join(' / ')})`)
    if (words.length) parts.push(`#${words.slice(0, WORDS_MAX).join(' #')}`)
    // 되묻기 단계는 버튼이 가리키는 안내도 적어 둔다 — 학생이 무엇을 고를지 모르겠다고 하면 서버가 그 원문들로 차이를 설명한다.
    const next = node.kind === 'question' ? [...new Set(node.options.map((option) => `${flow.id}/${option.next}`))] : undefined
    entries.push({ id: `${flow.id}/${nodeId}`, kind: node.kind, line: parts.join(' '), ...(next ? { next } : {}) })
    sources[`${flow.id}/${nodeId}`] = sourceText(flow, node)
    if (node.kind === 'answer' && (node.links?.length || node.phones?.length || node.facilityId)) {
      meta[`${flow.id}/${nodeId}`] = {
        links: (node.links ?? []).map(({ label, url }) => ({ label, url })),
        phones: (node.phones ?? []).map(({ label, phone }) => ({ label, phone })),
        ...(node.facilityId ? { facilityId: node.facilityId } : {}),
      }
    }
  }
}

const ids = new Set()
for (const { id } of entries) {
  if (ids.has(id)) throw new Error(`id 가 겹친다: ${id}`)
  ids.add(id)
}

const version = createHash('sha256').update(JSON.stringify([entries, sources, meta])).digest('hex').slice(0, 12)
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'catalog.json'), `${JSON.stringify({ version, entries }, null, 1)}\n`)
writeFileSync(join(outDir, 'sources.json'), `${JSON.stringify({ version, sources, meta }, null, 1)}\n`)
console.log(`${entries.length}개 노드 → ${outDir}catalog.json · sources.json (version ${version})`)
