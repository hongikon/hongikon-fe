import type { NewsItem } from '../types'
import type { BackendNewsSummary, BackendNewsDetail } from '../apis/news'

/** ISO 'YYYY-MM-DDTHH:mm:ss' → 'YYYY.MM.DD'(NewsItem.date 형식, NewsCard 등이 그대로 문자열로 보여준다). */
function formatDate(publishedAt: string): string {
  return publishedAt.slice(0, 10).replace(/-/g, '.')
}

/**
 * 목록(`GET /news`) 항목을 화면이 쓰는 `NewsItem`으로 변환한다.
 * `sourceId`는 구독 필터링(`SettingsContext.subscribedDepts`)이 TREE_DATA 리프 id 기준이라
 * 백엔드 `sourceId`(수집 게시판 id)를 우선 쓴다. 대학공지('학사'/'장학' 등)는 학과가 아니라
 * `departmentName`이 항상 null이므로 이 값이 없으면 구독해도 안 보인다. `sourceId`가 없는
 * 이전 백엔드/기존 글이면 `departmentName`(= TREE_DATA 학과 리프 id와 같은 문자열) → '기타' 순으로 폴백.
 * 표시용 `source`는 학과명을 우선하고, 대학공지는 분류 라벨(예: '학사')을 그대로 보여준다.
 */
export function backendSummaryToNewsItem(n: BackendNewsSummary): NewsItem {
  return {
    id: String(n.id),
    category: n.category,
    title: n.title,
    preview: n.preview ?? '',
    source: n.departmentName ?? n.sourceId ?? '홍익대학교',
    sourceId: n.sourceId ?? n.departmentName ?? '기타',
    date: formatDate(n.publishedAt),
  }
}

/**
 * 상세(`GET /news/{id}`) 항목을 `NewsItem`으로 변환한다. `preview`엔 전체 본문을 담는다 —
 * `NewsDetailScreen`이 이 필드를 본문으로 그대로 렌더링하기 때문(목록 카드용 짧은 요약과
 * 같은 필드를 재사용하는 기존 `NewsItem` 설계).
 */
export function backendDetailToNewsItem(n: BackendNewsDetail): NewsItem {
  return {
    ...backendSummaryToNewsItem(n),
    preview: n.content ?? n.preview ?? '',
    link: n.sourceUrl,
    images: n.images,
    attachments: n.attachments,
  }
}
