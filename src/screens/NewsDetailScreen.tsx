import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useSettings } from '../contexts/SettingsContext'
import ScreenHeader from '../components/common/ScreenHeader'
import { ModalPanel } from '../components/settings/ModalHeader'
import { useFeedbackToggles } from '../hooks/settings/useFeedbackToggles'
import { useEnhancedNewsItem } from '../hooks/news/useEnhancedNewsItem'
import { useShareNewsItem } from '../hooks/news/useShareNewsItem'
import NewsDetailArticle from '../components/news/detail/NewsDetailArticle'
import NewsDetailFooter from '../components/news/detail/NewsDetailFooter'
import NewsDetailHeaderActions from '../components/news/detail/NewsDetailHeaderActions'
import NewsDetailLoadState from '../components/news/detail/NewsDetailLoadState'
import type { NewsItem } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'NewsDetail'>

/**
 * 소식 상세. 목록에서 온 요약(`item`)이나 알림의 `newsId` 로 열리고, 백엔드 소식이면 본문·첨부를 상세 API 로 채운다
 * (`hooks/news/useEnhancedNewsItem`).
 */
export default function NewsDetailScreen({ route, navigation }: Props) {
  const { item, loadingMore, detail, notFound } = useEnhancedNewsItem(route.params)

  // 알림으로 들어와 아직 아무것도 없을 때: 받는 중이면 본문 모양의 스켈레톤, 실패하면 다시 시도 안내.
  if (!item) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="소식 상세" onBack={() => navigation.goBack()} card style={layoutStyles.readable} />
        <View style={[styles.column, layoutStyles.readable]}>
          <ModalPanel>
            <NewsDetailLoadState detail={detail} notFound={notFound} />
          </ModalPanel>
        </View>
      </SafeAreaView>
    )
  }

  return <NewsDetailBody item={item} loadingMore={loadingMore} onBack={() => navigation.goBack()} />
}

function NewsDetailBody({
  item,
  loadingMore,
  onBack,
}: {
  item: NewsItem
  loadingMore: boolean
  onBack: () => void
}) {
  const { isBookmarked } = useSettings()
  const { toggleBookmark } = useFeedbackToggles()
  const bookmarked = isBookmarked(item.id)
  const handleShare = useShareNewsItem(item)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="소식 상세"
        onBack={onBack}
        card
        style={layoutStyles.readable}
        right={
          <NewsDetailHeaderActions
            title={item.title}
            bookmarked={bookmarked}
            onShare={() => void handleShare()}
            onToggleBookmark={() => toggleBookmark(item.id)}
          />
        }
      />

      {/* 회색 바탕 위 둥근 흰 판에 본문을 담는다(10-07 — 설정 창들과 같은 모양). */}
      <View style={[styles.column, layoutStyles.readable]}>
        <ModalPanel>
          <NewsDetailArticle item={item} loadingMore={loadingMore} />
        </ModalPanel>
      </View>

      <NewsDetailFooter link={item.link} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  column: { flex: 1 },
})
