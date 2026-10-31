import type { NewsItem } from '../types'
import { shareLink, type ShareResult } from './share'
import { SHARE_ORIGIN } from './shareReport'

/** 본문 미리보기 길이(글자). 메신저 미리보기에서 두 줄 남짓. */
const EXCERPT_CHARS = 70

/** 홍익온 웹의 공지 상세(`/news/{id}`, `navigation/linking.ts`). 앱이 없어도 웹에서 열린다. */
export function newsShareUrl(newsId: string): string {
  return `${SHARE_ORIGIN}/news/${encodeURIComponent(newsId)}`
}

/** 본문 앞부분 한 줄(줄바꿈·연속 공백을 하나로). 본문이 없으면(이미지뿐인 공지) null. */
export function newsExcerpt(text: string): string | null {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  const chars = Array.from(flat)
  if (chars.length <= EXCERPT_CHARS) return flat
  const cut = chars.slice(0, EXCERPT_CHARS).join('')
  // 낱말 가운데서 끊기지 않게 마지막 띄어쓰기에서 자른다(너무 앞이면 그냥 자른다).
  const space = cut.lastIndexOf(' ')
  return `${(space >= EXCERPT_CHARS * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/**
 * 공지 공유 문구(11-01). 홍익온 형식: 머리표·제목 / 출처·날짜·분야 / 본문 앞부분 / 홍익온 링크(웹 공지 화면).
 * 원문은 학교 홈페이지 글이라 출처 게시판을 꼭 적는다.
 */
export function newsShareMessage(item: NewsItem): string {
  const excerpt = newsExcerpt(item.preview)
  return [
    `[홍익온 공지] ${item.title}`,
    [item.source, item.date, item.category].filter(Boolean).join(' · '),
    ...(excerpt ? [excerpt] : []),
    // 링크는 마지막 줄에 따로 — iOS 공유 창이 떼어 링크 미리보기로 붙인다(`shareLink`).
    newsShareUrl(item.id),
  ].join('\n')
}

export function shareNews(item: NewsItem): Promise<ShareResult> {
  return shareLink({ title: item.title, message: newsShareMessage(item), url: newsShareUrl(item.id), dialogTitle: '공지 공유하기' })
}
