import { apiRequest } from './client'
import type { CategoryKey } from '../constants/colors'

/**
 * `GET /news`, `GET /news/{id}` 항목. FE 크롤러 데이터(`NewsItem`, `constants/news.ts`)와는
 * 다른 백엔드 자체 스키마다 — `images`/`attachments`/`views`/`source`(출처명) 필드가 없다
 * (2026-08-27 확인). `NEWS_DATA`를 대체하는 용도가 아니라, 백엔드가 직접 갖고 있는 소식만
 * 다루는 별도 계약이다.
 */
export interface BackendNewsSummary {
  id: number
  title: string
  category: CategoryKey
  departmentId: number | null
  buildingId: number | null
  publishedAt: string
}

export interface BackendNewsDetail extends BackendNewsSummary {
  content: string | null
  sourceUrl: string
}

interface GetNewsOptions {
  category?: CategoryKey
  departmentId?: number
  buildingId?: number
}

export async function getNews(options: GetNewsOptions = {}): Promise<BackendNewsSummary[]> {
  const params = new URLSearchParams()
  if (options.category) params.set('category', options.category)
  if (options.departmentId !== undefined) params.set('departmentId', String(options.departmentId))
  if (options.buildingId !== undefined) params.set('buildingId', String(options.buildingId))
  const query = params.toString()

  const { news } = await apiRequest<{ news: BackendNewsSummary[] }>(
    `/news${query ? `?${query}` : ''}`,
  )
  return news
}

export function getNewsById(id: number): Promise<BackendNewsDetail> {
  return apiRequest<BackendNewsDetail>(`/news/${id}`)
}
