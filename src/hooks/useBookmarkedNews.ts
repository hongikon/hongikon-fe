import { useMemo, useState } from 'react'
import { getNewsById } from '../apis/news'
import { ApiError } from '../apis/client'
import { backendSummaryToNewsItem } from '../utils/newsMapping'
import { useApiResource, type ApiResource } from './useApiResource'
import type { NewsItem } from '../types'

const isBackendId = (id: string) => /^\d+$/.test(id)

/**
 * 북마크한 소식 목록. `GET /news`가 페이지 단위로 바뀌어(hongikon-be 5f3024a) 목록에서
 * 북마크 id를 골라낼 수 없으므로 id마다 상세(`GET /news/{id}`)를 받아 온다.
 *
 * 한 번 받은 항목은 기억해 두고 새로 북마크한 id만 더 받는다(북마크 해제 때 다시 부르지 않음).
 * 지워진 글(404)은 조용히 빼고, 로컬 목데이터 시절의 숫자가 아닌 id("n1" 등)는 건너뛴다.
 */
export function useBookmarkedNews(ids: readonly string[]): Omit<ApiResource<NewsItem[]>, 'data'> & {
  items: NewsItem[]
} {
  // id → 항목. null 은 "서버에 없음(404)"이라 다시 묻지 않는다는 뜻.
  const [cache, setCache] = useState<Record<string, NewsItem | null>>({})

  const missing = ids.filter((id) => isBackendId(id) && !(id in cache))
  const missingKey = missing.join(',')

  const resource = useApiResource(
    async (signal) => {
      const results = await Promise.allSettled(missing.map((id) => getNewsById(Number(id), signal)))
      if (signal.aborted) return null
      const fetched: Record<string, NewsItem | null> = {}
      let firstError: unknown = null
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') fetched[missing[i]] = backendSummaryToNewsItem(result.value)
        else if (result.reason instanceof ApiError && result.reason.status === 404) fetched[missing[i]] = null
        else firstError ??= result.reason
      })
      // 받은 것은 먼저 넣고 실패를 알린다. 남은 id만 다시 묻게 되니 같은 실패가 무한 반복되지는 않는다.
      setCache((prev) => ({ ...prev, ...fetched }))
      if (firstError) throw firstError
      return null
    },
    [missingKey],
    { enabled: missing.length > 0, refetchOnForeground: false, fallbackMessage: '북마크한 소식을 불러오지 못했습니다.' },
  )

  const items = useMemo(
    () =>
      ids
        .map((id) => cache[id])
        .filter((n): n is NewsItem => Boolean(n))
        // 목록 화면들과 같이 최신순('YYYY.MM.DD' 문자열 비교).
        .sort((a, b) => b.date.localeCompare(a.date)),
    [ids, cache],
  )

  const { data: _data, ...rest } = resource
  return { ...rest, loading: resource.loading && items.length === 0, items }
}
