import { SUBSCRIBABLE_ITEMS } from '../../constants/news'
import type { NewsItem } from '../../types'

/**
 * 소식 탭(북마크·구독·전체) 피드의 계산. 화면·훅이 함께 쓰고 `scripts/test/news-feed.test.ts` 가 확인한다.
 */

export type NewsTab = '북마크' | '구독' | '전체'

/** 구독 학과 id → 표시 이름. 구독 칩에 쓴다. */
const DEPT_NAME_BY_ID = new Map(SUBSCRIBABLE_ITEMS.map((item) => [item.id, item.name]))

/** 구독 칩에 적을 이름. 목록에 없는 id 면 id 그대로. */
export function deptDisplayName(id: string): string {
  return DEPT_NAME_BY_ID.get(id) ?? id
}

/** 두 게시판 id 목록이 순서까지 같은지. 피드에 쓰는 구독 목록이 설정과 어긋났는지 볼 때 쓴다. */
export function sameSourceIds(a: readonly string[], b: readonly string[]): boolean {
  return a.join('\u0000') === b.join('\u0000')
}

/**
 * '내 구독' 칩으로 고른 게시판에 보여 줄 글. 전체(null)면 구독 피드 그대로, 게시판을 골랐으면 그 게시판만 받은 글.
 * 그 게시판 글을 아직 받는 중이고 하나도 없으면, 이미 받아 둔 구독 피드에서 그 게시판 글만 먼저 보여 준다.
 */
export function pickBoardItems(
  selectedSource: string | null,
  subscribedItems: NewsItem[],
  board: { items: NewsItem[]; loading: boolean },
): NewsItem[] {
  if (selectedSource === null) return subscribedItems
  if (board.items.length > 0 || !board.loading) return board.items
  return subscribedItems.filter((item) => item.sourceId === selectedSource)
}

/** 목록이 비었을 때 안내 문구. */
export function feedEmptyMessage(tab: NewsTab, selectedSource: string | null): string {
  if (tab === '북마크') return '북마크한 소식이 없어요'
  return selectedSource !== null ? '이 게시판의 소식이 아직 없어요' : '구독한 기관·학과의 소식이 없어요'
}
