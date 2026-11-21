import { useToast } from '../../components/common/Toast'
import { shareNews } from '../../utils/news/shareNews'
import type { NewsItem } from '../../types'

/**
 * 홍익온 형식으로 공유(제목·출처·날짜·분야·본문 앞부분·홍익온 링크, `utils/shareNews.ts`).
 * 웹처럼 공유 창이 없어 복사했거나 실패하면 토스트로 알린다.
 */
export function useShareNewsItem(item: NewsItem) {
  const toast = useToast()
  return async () => {
    const result = await shareNews(item)
    if (result === 'copied') toast.show({ message: '공유 문구와 링크를 복사했어요' })
    else if (result === 'failed') toast.show({ message: '공유하지 못했어요', tone: 'warning' })
  }
}
