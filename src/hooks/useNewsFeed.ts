import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getNews } from '../apis/news'
import {
  ApiError,
  getErrorMessage,
  isCancelledError,
  isNetworkError,
  isRetryableError,
} from '../apis/client'
import { useReconnect } from '../lib/connectivity'
import { backendSummaryToNewsItem } from '../utils/newsMapping'
import { ALL_CATEGORIES } from '../contexts/SettingsContext'
import type { CategoryKey } from '../constants/colors'
import type { NewsItem } from '../types'

/** 한 번에 받아 올 개수(백엔드 기본값과 같다, 서버 상한 50). */
export const NEWS_PAGE_SIZE = 20

/**
 * 카테고리를 클라이언트에서 거를 때, 한 페이지가 통째로 걸러져 목록이 안 늘면
 * FlatList 의 onEndReached 가 다시 안 불려 멈춘다. 그때 이 횟수까지만 다음 페이지를 알아서 더 받는다.
 */
const MAX_AUTO_FILL_PAGES = 5

export interface NewsFeedQuery {
  /** 수집 게시판 id(TREE_DATA 리프 id). 여러 개면 OR. 비우면 전체. */
  sourceIds?: readonly string[]
  /**
   * 보여줄 카테고리. 생략하거나 전부면 거르지 않는다.
   * 백엔드 `category` 파라미터는 하나만 받으므로 하나일 때만 서버에서 거르고,
   * 2개 이상(전부는 아님)이면 서버에선 거르지 않고 받아 온 페이지마다 클라이언트에서 거른다 —
   * 이 경우 걸러진 만큼 페이지가 덜 차므로 `MAX_AUTO_FILL_PAGES`까지 다음 페이지를 이어 받는다.
   */
  categories?: readonly CategoryKey[]
  /** 제목 부분 일치. */
  keyword?: string
}

interface UseNewsFeedOptions {
  /** false 면 부르지 않고 목록도 비운다(구독이 없을 때, 검색어가 비었을 때 등). 기본 true. */
  enabled?: boolean
}

type PendingMode = 'initial' | 'more' | 'refresh'

export interface NewsFeed {
  /** 지금까지 받은 페이지를 합친 목록(id 중복 제거, 최신순). */
  items: NewsItem[]
  /** 첫 페이지를 받는 중(보여줄 목록이 아직 없음). */
  loading: boolean
  /** 다음 페이지를 받는 중. */
  loadingMore: boolean
  /** 당겨서 새로고침 중. */
  refreshing: boolean
  hasNext: boolean
  /** 서버가 알려준 전체 건수(클라이언트 카테고리 필터 전). 아직 모르면 null. */
  totalElements: number | null
  errorMessage: string | null
  isNetworkError: boolean
  canRetry: boolean
  /** 실패한 요청을 다시 보낸다(첫 페이지면 첫 페이지, 다음 페이지면 다음 페이지). */
  retry: () => void
  /** 0페이지부터 다시 받는다. 받는 동안 기존 목록은 그대로 둔다. */
  refresh: () => void
  /** 목록 끝에 닿았을 때 부른다. 받는 중이거나 더 없으면 아무 일도 하지 않는다. */
  loadMore: () => void
}

/** 앞 목록에 없는 id만 뒤에 붙인다. 페이지 사이에 새 글이 끼면 같은 글이 다음 페이지에 또 온다. */
function appendUnique(prev: NewsItem[], next: NewsItem[]): NewsItem[] {
  const seen = new Set(prev.map((n) => n.id))
  const added = next.filter((n) => !seen.has(n.id) && (seen.add(n.id), true))
  return added.length === 0 ? prev : [...prev, ...added]
}

/** 카테고리 목록을 서버 파라미터 하나 / 클라이언트 필터 / 필터 없음 중 하나로 정한다. */
function resolveCategories(categories: readonly CategoryKey[] | undefined) {
  if (!categories || ALL_CATEGORIES.every((c) => categories.includes(c))) {
    return { server: undefined, client: null }
  }
  if (categories.length === 1) return { server: categories[0], client: null }
  return { server: undefined, client: new Set(categories) }
}

/**
 * 소식 목록(`GET /news`)을 페이지 단위로 받는 훅. 필터·검색은 서버가 한다.
 * `NewsScreen`(구독)/`DeptNewsScreen`/`NewsSearchScreen`이 각자 부른다(전역 캐싱 없음).
 *
 * - 조건(`query`)이 바뀌면 진행 중인 요청을 끊고 0페이지부터 다시 받는다.
 * - `loadMore`는 `hasNext`일 때만 다음 페이지를 받아 id 기준으로 중복 없이 붙인다.
 * - 오류 문구·다시 시도·재연결 시 자동 재시도는 `useApiResource`와 같은 기준을 따른다.
 */
export function useNewsFeed(query: NewsFeedQuery, options: UseNewsFeedOptions = {}): NewsFeed {
  const { enabled = true } = options

  const sourceKey = query.sourceIds?.join('\u0000') ?? ''
  const categoryKey = query.categories?.join(',') ?? ''
  const keyword = query.keyword?.trim() ?? ''

  // 매 렌더 새 배열이 와도 다시 부르지 않도록 문자열 키로만 조건을 비교한다.
  const request = useMemo(() => {
    const { server, client } = resolveCategories(
      categoryKey ? (categoryKey.split(',') as CategoryKey[]) : undefined,
    )
    return {
      sourceIds: sourceKey ? sourceKey.split('\u0000') : undefined,
      category: server,
      keyword: keyword || undefined,
      clientCategories: client,
    }
  }, [sourceKey, categoryKey, keyword])

  const [items, setItems] = useState<NewsItem[]>([])
  const [page, setPage] = useState(-1)
  const [hasNext, setHasNext] = useState(false)
  const [totalElements, setTotalElements] = useState<number | null>(null)
  const [pending, setPending] = useState<PendingMode | null>(null)
  const [error, setError] = useState<unknown>(null)

  const requestRef = useRef(request)
  requestRef.current = request
  const controllerRef = useRef<AbortController | null>(null)
  const failedModeRef = useRef<PendingMode | null>(null)
  const autoFillCountRef = useRef(0)
  const lastVisibleCountRef = useRef(0)

  const fetchPage = useCallback((targetPage: number, mode: PendingMode) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setPending(mode)

    const { sourceIds, category, keyword: kw } = requestRef.current
    getNews({ page: targetPage, size: NEWS_PAGE_SIZE, sourceIds, category, keyword: kw, signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return
        const next = res.content.map(backendSummaryToNewsItem)
        setItems((prev) => appendUnique(targetPage === 0 ? [] : prev, next))
        setPage(res.page)
        setHasNext(res.hasNext)
        setTotalElements(res.totalElements)
        setError(null)
        failedModeRef.current = null
      })
      .catch((caught: unknown) => {
        // 끊은 요청(화면 이탈, 조건 변경)은 결과를 버린다.
        if (controller.signal.aborted || isCancelledError(caught)) return
        failedModeRef.current = mode
        setError(caught)
        if (__DEV__ && !isNetworkError(caught)) console.warn('[useNewsFeed] 불러오기 실패:', caught)
      })
      .finally(() => {
        if (controllerRef.current === controller) {
          controllerRef.current = null
          setPending(null)
        }
      })
  }, [])

  useEffect(() => {
    autoFillCountRef.current = 0
    lastVisibleCountRef.current = 0
    failedModeRef.current = null
    setItems([])
    setPage(-1)
    setHasNext(false)
    setTotalElements(null)
    setError(null)
    if (!enabled) {
      controllerRef.current?.abort()
      controllerRef.current = null
      setPending(null)
      return
    }
    fetchPage(0, 'initial')
    return () => {
      controllerRef.current?.abort()
    }
  }, [enabled, request, fetchPage])

  const loadMore = useCallback(() => {
    // 실패한 뒤엔 onEndReached 로 연달아 부르지 않고 "다시 시도" 버튼에 맡긴다.
    if (!enabled || controllerRef.current || !hasNext || error !== null) return
    fetchPage(page + 1, 'more')
  }, [enabled, hasNext, error, page, fetchPage])

  const refresh = useCallback(() => {
    if (!enabled) return
    autoFillCountRef.current = 0
    lastVisibleCountRef.current = 0
    fetchPage(0, page < 0 ? 'initial' : 'refresh')
  }, [enabled, page, fetchPage])

  const retry = useCallback(() => {
    if (!enabled) return
    if (failedModeRef.current === 'more' && page >= 0) fetchPage(page + 1, 'more')
    else fetchPage(0, page < 0 ? 'initial' : 'refresh')
  }, [enabled, page, fetchPage])

  // 재연결 알림은 실패했던 경우에만 받는다(useApiResource 와 같은 기준).
  useReconnect(() => {
    if (failedModeRef.current) retry()
  }, enabled)

  const { clientCategories } = request
  const visibleItems = useMemo(
    () => (clientCategories ? items.filter((n) => clientCategories.has(n.category as CategoryKey)) : items),
    [items, clientCategories],
  )

  // 클라이언트 카테고리 필터로 한 화면이 안 차거나, 받은 페이지가 통째로 걸러져 목록이 안 늘었으면
  // 다음 페이지를 이어 받는다(연속 MAX_AUTO_FILL_PAGES 번까지). 받기가 끝날 때마다 한 번씩 판단한다.
  useEffect(() => {
    if (!clientCategories || pending || error !== null) return
    const grew = visibleItems.length > lastVisibleCountRef.current
    lastVisibleCountRef.current = visibleItems.length
    if (grew && visibleItems.length >= NEWS_PAGE_SIZE) {
      autoFillCountRef.current = 0
      return
    }
    if (!hasNext || autoFillCountRef.current >= MAX_AUTO_FILL_PAGES) return
    autoFillCountRef.current += 1
    fetchPage(page + 1, 'more')
  }, [clientCategories, pending, error, hasNext, visibleItems.length, page, fetchPage])

  const hasError = error !== null
  return {
    items: visibleItems,
    loading: pending === 'initial',
    loadingMore: pending === 'more',
    refreshing: pending === 'refresh',
    hasNext,
    totalElements,
    errorMessage: hasError ? getErrorMessage(error, '소식을 불러오지 못했어요.') : null,
    isNetworkError: hasError && isNetworkError(error),
    canRetry: hasError && (isRetryableError(error) || !(error instanceof ApiError)),
    retry,
    refresh,
    loadMore,
  }
}
