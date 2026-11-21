import { StyleSheet } from 'react-native'
import RetryableError from '../../common/RetryableError'
import { NewsDetailSkeleton } from '../../common/Skeleton'
import type { NewsDetailResource } from '../../../hooks/news/useEnhancedNewsItem'

interface Props {
  detail: NewsDetailResource
  /** 숫자가 아닌 id 로 들어와 부를 API 가 없다(웹 `/news/abc`). */
  notFound: boolean
}

/**
 * 알림으로 들어와 아직 아무것도 없을 때: 받는 중이면 본문 모양의 스켈레톤, 실패하면 다시 시도 안내,
 * 찾을 수 없는 주소면 그 안내.
 */
export default function NewsDetailLoadState({ detail, notFound }: Props) {
  if (notFound) {
    return <RetryableError style={styles.loadError} message="소식을 찾을 수 없어요. 주소를 확인해 주세요." />
  }
  if (detail.errorMessage) {
    return (
      <RetryableError
        style={styles.loadError}
        message={detail.errorMessage}
        isNetworkError={detail.isNetworkError}
        onRetry={detail.canRetry ? detail.retry : undefined}
        retrying={detail.refreshing || detail.loading}
      />
    )
  }
  return <NewsDetailSkeleton />
}

const styles = StyleSheet.create({
  loadError: { margin: 16 },
})
