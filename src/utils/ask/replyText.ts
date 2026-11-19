import type { AskSection } from '../../constants/askAnswers'

/** 지도 위 설명 카드에 쓸 첫 문장(마크다운 굵게 표시는 뗀다, 90자까지). */
export function firstSentence(text: string | undefined): string | undefined {
  if (!text) return undefined
  const plain = text.replace(/\*\*/g, '').trim()
  const match = plain.match(/^[\s\S]*?(?:[.?!](?=\s|$)|\n)/)
  const first = (match ? match[0] : plain).trim()
  return first.length > 90 ? `${first.slice(0, 89).trimEnd()}…` : first || undefined
}

/**
 * 서버 답 없이 안내 원문을 그대로 보일 때의 상한. 학교 페이지를 통째로 옮긴 안내(교내장학금 등)는 수십 줄이고
 * 같은 소제목이 두 번 나오기도 해서(10-25 운영진 제보) 앞부분만 보이고 나머지는 아래 학교 페이지 버튼으로 넘긴다.
 */
const BRIEF_SECTIONS = 3
const BRIEF_ITEMS = 4
const BRIEF_TOTAL_ITEMS = 8
const BRIEF_TABLE_ROWS = 8

/** 안내 원문의 소제목·항목을 앞부분만 남긴다. cut 이면 잘린 것이 있다. */
export function briefSections(sections: readonly AskSection[] | undefined): { shown: AskSection[]; cut: boolean } {
  const shown: AskSection[] = []
  const titles = new Set<string>()
  let total = 0
  let cut = false
  for (const section of sections ?? []) {
    // 운영진 정리(tips)는 이미 짧게 쓴 것이라 통째로 보이고, 학교 원문 줄 수에 세지 않는다.
    if (section.full) {
      shown.push(section)
      continue
    }
    if (section.title && titles.has(section.title)) {
      cut = true
      continue
    }
    if (shown.filter((item) => !item.full).length >= BRIEF_SECTIONS || total >= BRIEF_TOTAL_ITEMS) {
      cut = true
      break
    }
    const room = Math.min(BRIEF_ITEMS, BRIEF_TOTAL_ITEMS - total)
    const items = section.items?.slice(0, room)
    const table = section.table ? { ...section.table, rows: section.table.rows.slice(0, BRIEF_TABLE_ROWS) } : undefined
    if ((section.items?.length ?? 0) > room || (section.table?.rows.length ?? 0) > BRIEF_TABLE_ROWS) cut = true
    total += items?.length ?? 0
    titles.add(section.title)
    shown.push({ ...section, items, table })
  }
  return { shown, cut }
}

/**
 * 서버 답 글을 안내 카드 모양으로 — 첫 단락은 요약, '[소제목]' 줄은 소제목, '- '·'1. ' 줄은 항목. 흘러나오는 도중에도 같은 모양으로 그린다.
 * 처음엔 글을 통째로 보여 줬더니 예전 안내 카드보다 읽기 힘들었다(10-16 사용자 지적).
 */
export function parseReply(text: string): { lead: string; sections: AskSection[]; tail: string } {
  const lead: string[] = []
  const tail: string[] = []
  const sections: { title: string; items: string[]; ordered?: boolean }[] = []
  let current: { title: string; items: string[]; ordered?: boolean } | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const heading = line.match(/^\[(.+)\]$/)
    if (heading) {
      tail.length = 0
      current = { title: heading[1], items: [] }
      sections.push(current)
      continue
    }
    const bullet = line.match(/^[-•·]\s+([\s\S]*)$/)
    const numbered = line.match(/^\d+[.)]\s+([\s\S]*)$/)
    if (bullet || numbered) {
      if (!current) {
        current = { title: '', items: [] }
        sections.push(current)
      }
      if (numbered && current.items.length === 0) current.ordered = true
      current.items.push((bullet ?? numbered)![1])
      continue
    }
    // 소제목 뒤에 '- ' 없이 온 줄은 그 소제목의 항목이 아니라 카드 끝 문장('다친 곳을 알려 주시면 …' 같은 되묻기).
    if (current) tail.push(line)
    else lead.push(line)
  }
  return { lead: lead.join(' '), sections, tail: tail.join(' ') }
}

/** '라벨: 내용' 항목이면 [라벨, 내용](서버 답이 '- 자격·조건: …'처럼 쓴다). 아니면 null. */
export function splitItemLabel(itemText: string): [label: string, rest: string] | null {
  const match = itemText.match(/^([^:：\n]{1,16})[:：]\s+([\s\S]+)$/)
  return match ? [match[1], match[2]] : null
}
