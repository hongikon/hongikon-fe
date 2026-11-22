import type { NewsItem } from '../types'
import { shareLink, type ShareResult } from './share'
import { SHARE_ORIGIN } from './shareReport'

/** 홍익온 웹의 공지 상세(`/news/{id}`, `navigation/linking.ts`). 앱이 없어도 웹에서 열린다. */
export function newsShareUrl(newsId: string): string {
  return `${SHARE_ORIGIN}/news/${encodeURIComponent(newsId)}`
}

/**
 * 공지 공유 문구(11-01, 11-22 다듬음): 제목 / 출처 · 날짜 / 링크.
 * - 원문은 학교 홈페이지 글이라 출처 게시판을 꼭 적는다.
 * - 머리표('[홍익온 공지]')와 본문 앞부분은 뺐다. 본문은 70자에서 잘려 문장 가운데서 끊겼고, 링크 미리보기 카드
 *   (`netlify/edge-functions/news-preview.ts`)가 홍익온 이름·첫 문장·그림을 이미 보여 준다.
 */
export function newsShareMessage(item: NewsItem): string {
  return [
    item.title,
    [item.source, item.date].filter(Boolean).join(' · '),
    // 링크는 마지막 줄에 따로 — iOS 공유 창이 떼어 링크 미리보기로 붙인다(`shareLink`).
    newsShareUrl(item.id),
  ]
    .filter(Boolean)
    .join('\n')
}

export function shareNews(item: NewsItem): Promise<ShareResult> {
  return shareLink({ title: item.title, message: newsShareMessage(item), url: newsShareUrl(item.id), dialogTitle: '공지 공유하기' })
}
