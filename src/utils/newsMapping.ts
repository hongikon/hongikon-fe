import type { NewsItem } from '../types'
import type { BackendNewsSummary, BackendNewsDetail } from '../apis/news'

/** ISO 'YYYY-MM-DDTHH:mm:ss' → 'YYYY.MM.DD'(NewsItem.date 형식, NewsCard 등이 그대로 문자열로 보여준다). */
function formatDate(publishedAt: string): string {
  return publishedAt.slice(0, 10).replace(/-/g, '.')
}

/**
 * 목록(`GET /news`) 항목을 화면이 쓰는 `NewsItem`으로 변환한다.
 * `sourceId`는 구독 필터링(`SettingsContext.subscribedDepts`)이 학과 이름 문자열 기준이라
 * `departmentName`을 그대로 쓴다 — TREE_DATA의 리프 id와 백엔드 Department.name이
 * 같은 문자열을 쓰도록 맞춰져 있다(`Department.java` 주석 참고).
 */
export function backendSummaryToNewsItem(n: BackendNewsSummary): NewsItem {
  return {
    id: String(n.id),
    category: n.category,
    title: n.title,
    preview: n.preview ?? '',
    source: n.departmentName ?? '홍익대학교',
    sourceId: n.departmentName ?? '기타',
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
    views: n.views ?? undefined,
    images: n.images,
    attachments: n.attachments,
  }
}
