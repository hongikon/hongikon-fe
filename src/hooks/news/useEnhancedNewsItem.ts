import { useApiResource } from '../query/useApiResource'
import { getNewsById } from '../../apis/news'
import { backendDetailToNewsItem } from '../../utils/newsMapping'
import { backendNewsId } from '../../utils/news/detail'
import type { RootStackParamList } from '../../navigation/RootNavigator'

/**
 * 목록 카드에서 온 `item`엔 짧은 preview만 있고 본문 전체·이미지·첨부파일은 없다
 * (`NewsSummaryResponse`엔 그 필드들이 없음). 백엔드 소식(id가 숫자 문자열)이면 상세 API로
 * 나머지를 채워 넣는다. 로컬 목데이터(`constants/news.ts`의 "n1" 같은 id)는 숫자가 아니라
 * 자동으로 건너뛴다.
 *
 * 푸시 알림처럼 `newsId`만 넘어오면(목록에서 찾을 수 없음 — `GET /news`가 페이지 단위) 상세 API
 * 결과만으로 그린다. 받기 전엔 `item`이 null.
 */
export function useEnhancedNewsItem(params: RootStackParamList['NewsDetail']) {
  const summary = 'item' in params ? params.item : null
  const id = 'item' in params ? params.item.id : params.newsId
  const backendId = backendNewsId(id)
  const detail = useApiResource(
    (signal) => getNewsById(backendId as number, signal),
    [backendId],
    { enabled: backendId !== null, fallbackMessage: '소식 본문을 불러오지 못했어요.' },
  )

  // 상세가 열린 채로 다른 소식 알림을 누르면 같은 화면의 params 만 바뀐다. useApiResource 는 실패해도
  // 마지막 값을 남겨 두므로, 지금 id 와 맞는 응답일 때만 쓴다(아니면 이전 소식이 그대로 보인다).
  const fresh = detail.data && String(detail.data.id) === id ? detail.data : null
  // 웹에서 `/news/abc` 처럼 숫자가 아닌 id 로 들어오면 부를 API 가 없어, 예전엔 스켈레톤이 끝없이 돌았다.
  const notFound = !summary && backendId === null
  if (!fresh) return { item: summary, loadingMore: detail.loading || detail.refreshing, detail, notFound }
  return { item: backendDetailToNewsItem(fresh), loadingMore: false, detail, notFound }
}

/** 상세 API 상태(받는 중·실패·다시 시도). 화면 컴포넌트에 넘길 때 쓴다. */
export type NewsDetailResource = ReturnType<typeof useEnhancedNewsItem>['detail']
