import { useMemo, useState } from 'react'
import { normalize } from '../utils/normalize'
import type { NewsItem } from '../types'

function searchableFields(item: NewsItem): string[] {
  return [item.title, item.preview, item.source]
}

/** 검색어에 걸리는 소식만 남긴다. 검색어가 비면 원본 그대로. */
function filterNews(items: readonly NewsItem[], query: string): NewsItem[] {
  const keyword = normalize(query)
  if (keyword.length === 0) return [...items]

  return items.filter((item) =>
    searchableFields(item).some((field) => normalize(field).includes(keyword)),
  )
}

interface NewsSearch {
  query: string
  setQuery: (value: string) => void
  /** 검색어가 걸러낸 소식. 검색 중이 아니면 원본. */
  results: NewsItem[]
  /** 검색 중인지. 빈 결과 문구를 검색어 기준으로 바꿀 때 쓴다. */
  isSearching: boolean
}

/** 제목·미리보기·출처로 소식을 훑는다. (hooks/useTreeSearch.ts 와 같은 훅 모양) */
export function useNewsSearch(items: readonly NewsItem[]): NewsSearch {
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterNews(items, query), [items, query])

  return {
    query,
    setQuery,
    results,
    isSearching: query.trim().length > 0,
  }
}
