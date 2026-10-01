import { apiRequest } from './client'
import type { CategoryKey } from '../constants/colors'

/**
 * `GET /news`, `GET /news/{id}` 항목. 2026-08-27엔 `images`/`attachments`/`views`/`source`(출처명)가
 * 빠져 있어 `NEWS_DATA`(`constants/news.ts`)를 대체할 수 없었지만, 2026-09-23 백엔드가
 * departmentName/preview(목록)·images/attachments/views(상세)를 채워 넣도록 고쳐져(hongikon-be
 * a236aec) 이제 `NewsScreen` 등의 실제 데이터 소스로 쓴다 — `utils/newsMapping.ts`가
 * `NewsItem`으로 변환한다.
 */
export interface BackendNewsAttachment {
  name: string
  url: string
}

export interface BackendNewsSummary {
  id: number
  title: string
  /** 본문 앞부분 요약(최대 80자). 본문이 없으면(이미지뿐인 공지 등) null. */
  preview: string | null
  category: CategoryKey
  departmentId: number | null
  /** 출처 표시명(예: "컴퓨터공학과"). department 미매칭 소식은 null. */
  departmentName: string | null
  /**
   * 수집 게시판 id(TREE_DATA 리프 id와 동일). 학과 게시판이면 학과명, 대학공지면 '학사'/'장학' 등.
   * 대학공지는 departmentName이 항상 null이라 구독 필터링엔 이 값이 필요하다.
   * 컬럼 도입 전 글은 null일 수 있다.
   */
  sourceId: string | null
  buildingId: number | null
  publishedAt: string
}

export interface BackendNewsDetail extends BackendNewsSummary {
  content: string | null
  images: string[]
  attachments: BackendNewsAttachment[]
  views: number | null
  sourceUrl: string
}

/** `GET /news` 응답(백엔드 `PageResponse<NewsSummaryResponse>`, hongikon-be 5f3024a). */
export interface NewsPage {
  content: BackendNewsSummary[]
  /** 현재 페이지 번호(0부터). */
  page: number
  /** 페이지 크기(서버 상한 50 적용 후). */
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

export interface GetNewsOptions {
  /** 0부터. 기본 0. */
  page?: number
  /** 기본 20, 서버 상한 50(넘기면 50으로 맞춰진다). */
  size?: number
  /** 백엔드는 category 를 하나만 받는다(여러 개는 지원 안 함). */
  category?: CategoryKey
  departmentId?: number
  buildingId?: number
  /** 수집 게시판 id(TREE_DATA 리프 id). 여러 개면 `sourceId=학사&sourceId=장학`처럼 반복해 보내고 서버는 그중 하나(OR)로 거른다. */
  sourceIds?: readonly string[]
  /** 제목 부분 일치. */
  keyword?: string
  signal?: AbortSignal
}

/**
 * 소식 목록 한 페이지. 항상 최신순이고, 조건끼리는 서버에서 AND로 조합된다.
 * 2026-10-01 백엔드가 `{ news: [...] }` 전체 목록 → 페이지 응답으로 바뀌었다(hongikon-be 5f3024a).
 */
export function getNews(options: GetNewsOptions = {}): Promise<NewsPage> {
  const params = new URLSearchParams()
  if (options.page !== undefined) params.set('page', String(options.page))
  if (options.size !== undefined) params.set('size', String(options.size))
  if (options.category) params.set('category', options.category)
  if (options.departmentId !== undefined) params.set('departmentId', String(options.departmentId))
  if (options.buildingId !== undefined) params.set('buildingId', String(options.buildingId))
  options.sourceIds?.forEach((id) => params.append('sourceId', id))
  const keyword = options.keyword?.trim()
  if (keyword) params.set('keyword', keyword)
  const query = params.toString()

  return apiRequest<NewsPage>(`/news${query ? `?${query}` : ''}`, { signal: options.signal })
}

export function getNewsById(id: number, signal?: AbortSignal): Promise<BackendNewsDetail> {
  return apiRequest<BackendNewsDetail>(`/news/${id}`, { signal })
}
