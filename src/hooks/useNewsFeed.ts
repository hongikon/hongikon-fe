import { useMemo } from 'react'
import { getNews } from '../apis/news'
import { backendSummaryToNewsItem } from '../utils/newsMapping'
import { useApiResource, type ApiResource } from './useApiResource'
import type { NewsItem } from '../types'

/**
 * 소식 탭 전체가 공유하는 데이터 소스. `NewsScreen`(북마크·구독)/`DeptNewsScreen`/
 * `NewsSearchScreen`이 각자 이 훅을 불러 백엔드 `GET /news`를 가져오고, 필터링·검색은
 * 기존처럼 화면별로 클라이언트에서 한다(데이터셋이 작아 서버 필터 파라미터 없이도 충분).
 *
 * 화면마다 따로 fetch 한다(전역 캐싱 없음) — 이 앱의 다른 API 훅들과 같은 패턴을 따른다.
 */
export function useNewsFeed(): ApiResource<NewsItem[]> {
  const resource = useApiResource(
    (signal) => getNews({ signal }),
    [],
    { fallbackMessage: '소식을 불러오지 못했습니다.' },
  )

  const items = useMemo(() => resource.data?.map(backendSummaryToNewsItem) ?? [], [resource.data])

  return { ...resource, data: items }
}
