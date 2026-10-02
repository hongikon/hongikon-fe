import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, CATEGORY_COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import type { CategoryKey } from '../constants/colors'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useSettings } from '../contexts/SettingsContext'
import { useApiResource } from '../hooks/useApiResource'
import { getNewsById } from '../apis/news'
import { backendDetailToNewsItem } from '../utils/newsMapping'
import { FONTS } from '../constants/typography'
import RetryableError from '../components/common/RetryableError'
import ScreenHeader from '../components/common/ScreenHeader'
import IconButton from '../components/common/IconButton'
import Button from '../components/common/Button'
import { NewsDetailSkeleton, DetailBodySkeleton } from '../components/common/Skeleton'
import { useFeedbackToggles } from '../hooks/useFeedbackToggles'
import type { NewsItem } from '../types'
import { openExternalUrl } from '../utils/openExternalUrl'

type Props = NativeStackScreenProps<RootStackParamList, 'NewsDetail'>

/**
 * 목록 카드에서 온 `item`엔 짧은 preview만 있고 본문 전체·이미지·첨부파일·조회수는 없다
 * (`NewsSummaryResponse`엔 그 필드들이 없음). 백엔드 소식(id가 숫자 문자열)이면 상세 API로
 * 나머지를 채워 넣는다. 로컬 목데이터(`constants/news.ts`의 "n1" 같은 id)는 숫자가 아니라
 * 자동으로 건너뛴다.
 *
 * 푸시 알림처럼 `newsId`만 넘어오면(목록에서 찾을 수 없음 — `GET /news`가 페이지 단위) 상세 API
 * 결과만으로 그린다. 받기 전엔 `item`이 null.
 */
function useEnhancedNewsItem(params: RootStackParamList['NewsDetail']) {
  const summary = 'item' in params ? params.item : null
  const id = 'item' in params ? params.item.id : params.newsId
  const backendId = /^\d+$/.test(id) ? Number(id) : null
  const detail = useApiResource(
    (signal) => getNewsById(backendId as number, signal),
    [backendId],
    { enabled: backendId !== null, fallbackMessage: '소식 본문을 불러오지 못했어요.' },
  )

  // 상세가 열린 채로 다른 소식 알림을 누르면 같은 화면의 params 만 바뀐다. useApiResource 는 실패해도
  // 마지막 값을 남겨 두므로, 지금 id 와 맞는 응답일 때만 쓴다(아니면 이전 소식이 그대로 보인다).
  const fresh = detail.data && String(detail.data.id) === id ? detail.data : null
  if (!fresh) return { item: summary, loadingMore: detail.loading || detail.refreshing, detail }
  return { item: backendDetailToNewsItem(fresh), loadingMore: false, detail }
}

export default function NewsDetailScreen({ route, navigation }: Props) {
  const { item, loadingMore, detail } = useEnhancedNewsItem(route.params)

  // 알림으로 들어와 아직 아무것도 없을 때: 받는 중이면 본문 모양의 스켈레톤, 실패하면 다시 시도 안내.
  if (!item) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <ScreenHeader title="소식 상세" onBack={() => navigation.goBack()} border={false} style={layoutStyles.readable} />
        </View>
        {detail.errorMessage ? (
          <RetryableError
            style={styles.loadError}
            message={detail.errorMessage}
            isNetworkError={detail.isNetworkError}
            onRetry={detail.canRetry ? detail.retry : undefined}
            retrying={detail.refreshing || detail.loading}
          />
        ) : (
          <NewsDetailSkeleton />
        )}
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
  const catColor = CATEGORY_COLORS[item.category as CategoryKey]
  const bookmarked = isBookmarked(item.id)
  const originalLabel = item.link ? '원문 보기' : '원문 보기 (홍익대 홈페이지)'
  const originalA11yLabel = item.link ? '원문 보기' : '원문 보기, 홍익대 홈페이지'
  const openOriginal = () => openExternalUrl(item.link, 'https://www.hongik.ac.kr')

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <ScreenHeader
          title="소식 상세"
          onBack={onBack}
          border={false}
          style={layoutStyles.readable}
          right={
            <IconButton
              icon={bookmarked ? 'bookmark' : 'bookmark-outline'}
              color={bookmarked ? COLORS.primary : COLORS.textSecondary}
              onPress={() => toggleBookmark(item.id)}
              accessibilityLabel={bookmarked ? `${item.title} 북마크 해제` : `${item.title} 북마크`}
            />
          }
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, layoutStyles.readable]}>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: catColor?.bg }]}>
            <Text style={[styles.badgeText, { color: catColor?.text }]}>{item.category}</Text>
          </View>
          <Text style={styles.date}>
            {item.date}
            {typeof item.views === 'number' ? ` · 조회 ${item.views}` : ''}
          </Text>
        </View>

        {/* 출처 게시판을 제목보다 먼저 보여 준다 — 학교 홈페이지 글을 옮겨 보여 준다는 걸 분명히 한다(스토어 5.2.2). */}
        <View style={styles.sourceRow}>
          <Ionicons name="business-outline" size={14} color={COLORS.textTertiary} />
          <Text style={styles.sourceName} numberOfLines={1}>
            <Text style={styles.sourceLabel}>출처{'  '}</Text>
            {item.source}
          </Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>

        {/* 원문 보기가 이 화면의 주된 행동이다. 본문은 참고용 요약이라 원문 확인을 먼저 권한다. */}
        <Button
          icon="open-outline"
          label={originalLabel}
          onPress={openOriginal}
          accessibilityRole="link"
          accessibilityLabel={originalA11yLabel}
          style={styles.originalButton}
        />

        <View style={styles.divider} />

        {/* 목록에서 온 짧은 미리보기 대신 본문 자리 모양을 보여주고, 다 받으면 본문으로 바꾼다. */}
        {loadingMore ? (
          <DetailBodySkeleton />
        ) : (
          item.preview.length > 0 && <Text style={styles.body}>{item.preview}</Text>
        )}

        {/* 크롤러가 목록만 긁었거나 본문이 이미지뿐이면 미리보기가 비어 있다. */}
        {!loadingMore && item.preview.length === 0 && (
          <Text style={styles.bodyPlaceholder}>
            {item.images?.length
              ? '본문이 이미지로만 되어 있어요. 원문에서 확인해 주세요.'
              : '본문 미리보기가 없어요. 원문에서 확인해 주세요.'}
          </Text>
        )}

        {item.attachments && item.attachments.length > 0 && (
          <View style={styles.attachBox}>
            <Text style={styles.attachLabel}>첨부파일 {item.attachments.length}</Text>
            {item.attachments.map((file) => (
              <TouchableOpacity
                key={file.url}
                style={styles.attachRow}
                onPress={() => openExternalUrl(file.url)}
                accessibilityRole="link"
                accessibilityLabel={`${file.name} 내려받기`}
              >
                <Ionicons name="document-attach-outline" size={15} color={COLORS.primary} />
                <Text style={styles.attachName} numberOfLines={1}>{file.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 긴 본문을 다 읽은 뒤에도 다시 올라가지 않고 원문을 열 수 있게 아래에도 둔다(보조 모양). */}
        <Button
          variant="secondary"
          icon="open-outline"
          label={originalLabel}
          onPress={openOriginal}
          accessibilityRole="link"
          accessibilityLabel={originalA11yLabel}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  headerBar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  loadError: { margin: 16 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 12, fontFamily: FONTS.semibold },
  date: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  title: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    lineHeight: 28,
    marginBottom: 12,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sourceName: { flex: 1, fontSize: 13, color: COLORS.textSecondary, fontFamily: FONTS.medium },
  sourceLabel: { fontFamily: FONTS.semibold, color: COLORS.textTertiary },
  originalButton: { marginTop: 4, marginBottom: 20 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginBottom: 20 },
  body: { fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: 12,
  },
  bodyPlaceholder: { fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textTertiary,
    marginBottom: 24,
  },
  attachBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  attachLabel: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  attachName: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: COLORS.primary },
})
