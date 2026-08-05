import { useCallback, useEffect, useMemo, useState } from 'react'

/** 한 번에 더 보여줄 개수. 화면 하나를 채우고 조금 남는 정도. */
const DEFAULT_PAGE_SIZE = 12

interface PagedItems<T> {
  /** 지금 화면에 내보낼 몫. */
  visible: T[]
  /** 아직 남은 게 있는지. 목록 끝의 로딩 표시에 쓴다. */
  hasMore: boolean
  /** 끝에 닿았을 때 호출한다. 남은 게 없으면 아무 일도 하지 않는다. */
  loadMore: () => void
}

/**
 * 목록을 조금씩 늘려 보여준다.
 *
 * 자료는 이미 메모리에 다 있지만 500건을 한 번에 렌더하면 화면이 처음 뜰 때 눈에 띄게 밀린다.
 * FlatList 의 가상화만으로도 화면 밖 항목은 정리되지만, 첫 렌더에서 만드는 항목 수 자체를
 * 줄여야 진입이 빨라진다.
 */
export function usePagedItems<T>(
  items: readonly T[],
  pageSize: number = DEFAULT_PAGE_SIZE,
): PagedItems<T> {
  const [visibleCount, setVisibleCount] = useState(pageSize)

  // 목록이 통째로 바뀌면(학과 이동, 탭 전환) 처음부터 다시 센다.
  useEffect(() => {
    setVisibleCount(pageSize)
  }, [items, pageSize])

  const visible = useMemo(() => items.slice(0, visibleCount), [items, visibleCount])

  const loadMore = useCallback(() => {
    setVisibleCount((current) => (current >= items.length ? current : current + pageSize))
  }, [items.length, pageSize])

  return {
    visible,
    hasMore: visibleCount < items.length,
    loadMore,
  }
}
