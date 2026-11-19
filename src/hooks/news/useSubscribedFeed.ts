import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import type { FlatList } from 'react-native'
import { useNewsFeed } from '../useNewsFeed'
import { pickBoardItems, sameSourceIds } from '../../utils/news/feed'
import type { NewsItem } from '../../types'

interface Options {
  /** 설정의 구독 게시판(리프 id). */
  subscribedDepts: string[]
  /** 소식 화면이 보이고 '구독' 탭이 열려 있는지. 이 동안은 피드에 쓰는 구독 목록을 고정한다. */
  onSubscribedView: boolean
  /** 게시판 칩을 바꾸면 목록을 맨 위로 올린다. */
  listRef: RefObject<FlatList<NewsItem> | null>
}

/**
 * 소식 탭 '구독' 피드. 구독한 게시판(리프 id)들을 sourceId 로 서버에서 거른다. 구독이 없으면 부르지 않고 빈 화면 안내를
 * 그대로 보여준다. 분야로는 거르지 않는다 — 설정의 '알림 받을 분야'는 푸시 알림에만 쓰이고 피드와는 따로다.
 *
 * 피드에 쓰는 구독 목록(feedSourceIds)은 구독 화면을 보는 동안에는 고정한다. '관리'에서 하나 지우거나 더할 때마다
 * 목록을 비우고 처음부터 다시 받아, 뼈대 화면이 뜨며 '내 구독' 카드까지 사라졌다 나타나고 맨 위로 튀었다(11-06).
 * 지운 게시판 글은 화면에서 바로 빼고(subscribedItems), 새로 받는 건 구독 화면을 벗어날 때(다른 탭·다른 화면) 뒤에서 한다.
 * 서버 구독(알림)은 이와 따로 SettingsContext 가 바로 맞춘다. 당겨서 새로고침하면 그때도 맞춘다.
 *
 * '내 구독' 칩으로 고른 게시판(null = 전체)은 따로 받아 끝까지 넘겨 볼 수 있게 한다.
 */
export function useSubscribedFeed({ subscribedDepts, onSubscribedView, listRef }: Options) {
  const [feedSourceIds, setFeedSourceIds] = useState<readonly string[]>(subscribedDepts)
  useEffect(() => {
    // 구독이 하나도 없던 상태에서 처음 구독하면 비울 목록이 없어 바로 받는다(빈 안내가 남지 않게).
    if (!onSubscribedView || feedSourceIds.length === 0) setFeedSourceIds(subscribedDepts)
  }, [onSubscribedView, subscribedDepts, feedSourceIds.length])
  const subscribedFeed = useNewsFeed(
    { sourceIds: feedSourceIds },
    // 탭을 오갈 때마다 다시 받지 않도록 활성 탭과 무관하게 켜 둔다.
    { enabled: feedSourceIds.length > 0 },
  )
  const subscribedSet = useMemo(() => new Set(subscribedDepts), [subscribedDepts])
  const subscribedItems = useMemo(
    () => subscribedFeed.items.filter((item) => subscribedSet.has(item.sourceId)),
    [subscribedFeed.items, subscribedSet],
  )
  // 고르는 동안 구독을 해제하면 전체로 돌아간다.
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  useEffect(() => {
    if (selectedSource !== null && !subscribedSet.has(selectedSource)) setSelectedSource(null)
  }, [selectedSource, subscribedSet])
  const boardFeed = useNewsFeed(
    { sourceIds: selectedSource !== null ? [selectedSource] : [] },
    { enabled: selectedSource !== null },
  )
  const selectSource = useCallback(
    (id: string | null) => {
      setSelectedSource(id)
      listRef.current?.scrollToOffset({ offset: 0, animated: false })
    },
    [listRef],
  )
  const activeFeed = selectedSource !== null ? boardFeed : subscribedFeed
  // 받는 동안은 이미 받아 둔 전체 목록에서 그 게시판 글만 먼저 보여 줘 빈 화면이 끼지 않게 한다.
  const boardItems = useMemo(
    () => pickBoardItems(selectedSource, subscribedItems, { items: boardFeed.items, loading: boardFeed.loading }),
    [selectedSource, subscribedItems, boardFeed.items, boardFeed.loading],
  )
  const feedPending = !sameSourceIds(feedSourceIds, subscribedDepts)
  const refreshSubscribed = useCallback(() => {
    if (selectedSource !== null) boardFeed.refresh()
    else if (feedPending) setFeedSourceIds(subscribedDepts)
    else subscribedFeed.refresh()
  }, [selectedSource, boardFeed, feedPending, subscribedDepts, subscribedFeed])

  return { subscribedFeed, activeFeed, boardItems, selectedSource, selectSource, refreshSubscribed }
}
