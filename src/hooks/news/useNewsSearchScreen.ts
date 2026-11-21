import { useCallback, useState } from 'react'
import { TREE_DATA } from '../../constants/news'
import { useSettings } from '../../contexts/SettingsContext'
import { useTreeSearch } from './useTreeSearch'
import { useNewsFeed } from './useNewsFeed'
import { useDebouncedValue } from '../common/useDebouncedValue'
import { useFeedbackToggles } from '../settings/useFeedbackToggles'
import { useSearchSheetDismiss } from './useSearchSheetDismiss'
import type { NewsItem } from '../../types'
import { type SearchMode } from '../../utils/news/newsSearchScreen'
import type { Props } from '../../screens/NewsSearchScreen'

/** NewsSearchScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNewsSearchScreen({ navigation, route }: Pick<Props, 'navigation' | 'route'>) {
  const { isBookmarked, settings } = useSettings()
  const { toggleBookmark, toggleSubscribedDept } = useFeedbackToggles()
  const [mode, setMode] = useState<SearchMode>('게시글')

  // 게시글 검색은 서버(`GET /news?keyword=`, 제목 부분 일치)가 한다. 타이핑마다 부르지 않도록
  // 300ms 디바운스하고, 검색어가 비면 필터 없는 전체 최신 소식을 보여준다.
  const [postQuery, setPostQuery] = useState(route.params?.query ?? '')
  const keyword = useDebouncedValue(postQuery.trim())
  const newsFeed = useNewsFeed({ keyword })
  const postSearch = { query: postQuery, setQuery: setPostQuery }
  const deptSearch = useTreeSearch(TREE_DATA)
  // 모드를 오가도 서로의 검색어를 지우지 않도록 상태를 둘 다 들고 있고,
  // 입력창은 현재 모드의 상태만 보여준다.
  const active = mode === '게시글' ? postSearch : deptSearch

  const handlePressItem = useCallback(
    (item: NewsItem) => navigation.navigate('NewsDetail', { item }),
    [navigation],
  )

  const handleSelectDept = useCallback(
    (id: string, name: string) => // 학과 소식은 소식 탭 안의 화면이다(탭바 유지). 검색 화면은 닫고 그쪽으로 간다.
      navigation.navigate('Main', { screen: 'News', params: { screen: 'DeptNews', params: { deptId: id, deptName: name } } }),
    [navigation],
  )

  // 아래로 끌어내려 닫기(머리 카드·iOS 목록 바운스)와 웹의 올라오기·내려가기(hooks/news/useSearchSheetDismiss).
  const goBack = useCallback(() => navigation.goBack(), [navigation])
  const { dragY, close, headerPan, handleScrollEndDrag } = useSearchSheetDismiss(goBack)
  return {
    isBookmarked,
    settings,
    toggleBookmark,
    toggleSubscribedDept,
    mode,
    setMode,
    keyword,
    newsFeed,
    deptSearch,
    active,
    handlePressItem,
    handleSelectDept,
    dragY,
    close,
    headerPan,
    handleScrollEndDrag,
  }
}
