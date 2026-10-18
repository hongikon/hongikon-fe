import type { NewsItem } from '../types'

/**
 * 구독 피드에서 하루 수십 건씩 올라오는 게시판(채용정보)을 날짜별 한 장으로 접는다(10-18 요청 — 채용 글에 학교 공지가 묻힘).
 *
 * - 같은 게시판·같은 날짜 글이 둘 이상이면, 그날 첫 글 자리에 묶음 한 줄(`fold`)을 두고 나머지는 뺀다.
 * - 펼친 묶음(`expandedKeys`)은 묶음 줄 바로 뒤에 그 글들을 원래 순서대로 붙인다.
 * - 하나뿐인 날은 접지 않고 보통 카드로 둔다.
 *
 * 다음 페이지가 붙으면 같은 날 글이 늘어 묶음 건수도 따라 는다(키가 같아 펼침 상태는 유지된다).
 */
export type NewsListRow =
  | { type: 'item'; key: string; item: NewsItem }
  | { type: 'fold'; key: string; sourceId: string; date: string; items: NewsItem[]; expanded: boolean }

export function foldKey(sourceId: string, date: string): string {
  return `fold:${sourceId}:${date}`
}

export function foldNewsRows(
  items: readonly NewsItem[],
  foldSourceIds: readonly string[] | undefined,
  expandedKeys: ReadonlySet<string>,
): NewsListRow[] {
  if (!foldSourceIds || foldSourceIds.length === 0) {
    return items.map((item) => ({ type: 'item', key: item.id, item }))
  }

  const folding = new Set(foldSourceIds)
  const groups = new Map<string, NewsItem[]>()
  for (const item of items) {
    if (!folding.has(item.sourceId)) continue
    const key = foldKey(item.sourceId, item.date)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  const rows: NewsListRow[] = []
  const placed = new Set<string>()
  for (const item of items) {
    const key = folding.has(item.sourceId) ? foldKey(item.sourceId, item.date) : null
    const group = key ? groups.get(key) : undefined
    if (!key || !group || group.length < 2) {
      rows.push({ type: 'item', key: item.id, item })
      continue
    }
    if (placed.has(key)) continue
    placed.add(key)
    const expanded = expandedKeys.has(key)
    rows.push({ type: 'fold', key, sourceId: item.sourceId, date: item.date, items: group, expanded })
    if (expanded) {
      for (const member of group) rows.push({ type: 'item', key: member.id, item: member })
    }
  }
  return rows
}
