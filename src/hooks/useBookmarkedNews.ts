import { useMemo, useState } from 'react'
import { getNewsById } from '../apis/news'
import { ApiError } from '../apis/client'
import { backendSummaryToNewsItem } from '../utils/newsMapping'
import { settleWithConcurrency } from '../utils/concurrency'
import { useApiResource, type ApiResource } from './useApiResource'
import type { NewsItem } from '../types'

const isBackendId = (id: string) => /^\d+$/.test(id)

/** 상세를 동시에 몇 개까지 받을지. 북마크가 수십 개여도 한꺼번에 요청을 쏟아내지 않는다. */
const MAX_CONCURRENT_FETCHES = 4

/**
 * 받은 항목(id → 항목, null 은 404). 화면이 다시 붙어도(탭 이동·재마운트) 이미 받은 글은 다시 묻지 않게
 * 훅 밖에 둔다. 소식 상세는 거의 바뀌지 않고, 바뀌어도 북마크 목록에는 제목·날짜 정도만 쓴다.
 */
const sharedCache = new Map<string, NewsItem | null>()

/**
 * 북마크한 소식 목록. `GET /news`가 페이지 단위로 바뀌어(hongikon-be 5f3024a) 목록에서
 * 북마크 id를 골라낼 수 없으므로 id마다 상세(`GET /news/{id}`)를 받아 온다.
 *
 * 한 번 받은 항목은 기억해 두고(`sharedCache`) 새로 북마크한 id만 더 받는다. 받는 도중 북마크가 또 바뀌어
 * 요청이 끊겨도 그때까지 받은 것은 버리지 않는다. 동시에 `MAX_CONCURRENT_FETCHES` 개까지만 보낸다.
 * 지워진 글(404)은 조용히 빼고, 로컬 목데이터 시절의 숫자가 아닌 id("n1" 등)는 건너뛴다.
 */
export function useBookmarkedNews(ids: readonly string[]): Omit<ApiResource<NewsItem[]>, 'data'> & {
  items: NewsItem[]
} {
  // 공유 캐시가 바뀐 것을 화면에 반영하려고 버전만 올린다.
  const [cacheVersion, setCacheVersion] = useState(0)

  const missing = ids.filter((id) => isBackendId(id) && !sharedCache.has(id))
  const missingKey = missing.join(',')

  const resource = useApiResource(
    async (signal) => {
      let firstError: unknown = null
      let added = false
      await settleWithConcurrency(missing, MAX_CONCURRENT_FETCHES, async (id) => {
        // 이미 끊긴 요청이면 남은 id 는 보내지 않는다(다음 실행이 다시 고른다).
        if (signal.aborted) return
        try {
          const news = await getNewsById(Number(id), signal)
          sharedCache.set(id, backendSummaryToNewsItem(news))
          added = true
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            sharedCache.set(id, null)
            added = true
          } else {
            firstError ??= error
          }
        }
      })
      // 받은 것은 먼저 반영하고 실패를 알린다. 남은 id만 다시 묻게 되니 같은 실패가 무한 반복되지는 않는다.
      if (added) setCacheVersion((v) => v + 1)
      if (signal.aborted) return null
      if (firstError) throw firstError
      return null
    },
    [missingKey],
    { enabled: missing.length > 0, refetchOnForeground: false, fallbackMessage: '북마크한 소식을 불러오지 못했습니다.' },
  )

  const items = useMemo(
    () =>
      ids
        .map((id) => sharedCache.get(id))
        .filter((n): n is NewsItem => Boolean(n))
        // 목록 화면들과 같이 최신순('YYYY.MM.DD' 문자열 비교).
        .sort((a, b) => b.date.localeCompare(a.date)),
    // 공유 캐시는 훅 밖이라 버전(cacheVersion)으로 따라간다.
    [ids, cacheVersion],
  )

  const { data: _data, ...rest } = resource
  return { ...rest, loading: resource.loading && items.length === 0, items }
}
