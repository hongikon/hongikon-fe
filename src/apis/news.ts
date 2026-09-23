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

interface GetNewsOptions {
  category?: CategoryKey
  departmentId?: number
  buildingId?: number
  signal?: AbortSignal
}

export async function getNews(options: GetNewsOptions = {}): Promise<BackendNewsSummary[]> {
  const params = new URLSearchParams()
  if (options.category) params.set('category', options.category)
  if (options.departmentId !== undefined) params.set('departmentId', String(options.departmentId))
  if (options.buildingId !== undefined) params.set('buildingId', String(options.buildingId))
  const query = params.toString()

  const { news } = await apiRequest<{ news: BackendNewsSummary[] }>(
    `/news${query ? `?${query}` : ''}`,
    { signal: options.signal },
  )
  return news
}

export function getNewsById(id: number, signal?: AbortSignal): Promise<BackendNewsDetail> {
  return apiRequest<BackendNewsDetail>(`/news/${id}`, { signal })
}
