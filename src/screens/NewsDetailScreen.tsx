import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, CATEGORY_COLORS } from '../constants/colors'
import type { CategoryKey } from '../constants/colors'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useSettings } from '../contexts/SettingsContext'
import { useApiResource } from '../hooks/useApiResource'
import { getNewsById } from '../apis/news'
import { backendDetailToNewsItem } from '../utils/newsMapping'
import { FONTS } from '../constants/typography'
import type { NewsItem } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'NewsDetail'>

/**
 * 목록 카드에서 온 `item`엔 짧은 preview만 있고 본문 전체·이미지·첨부파일·조회수는 없다
 * (`NewsSummaryResponse`엔 그 필드들이 없음). 백엔드 소식(id가 숫자 문자열)이면 상세 API로
 * 나머지를 채워 넣는다. 로컬 목데이터(`constants/news.ts`의 "n1" 같은 id)는 숫자가 아니라
 * 자동으로 건너뛴다.
 */
function useEnhancedNewsItem(item: NewsItem) {
  const backendId = /^\d+$/.test(item.id) ? Number(item.id) : null
  const detail = useApiResource(
    (signal) => getNewsById(backendId as number, signal),
    [backendId],
    { enabled: backendId !== null, fallbackMessage: '소식 본문을 불러오지 못했습니다.' },
  )

  if (!detail.data) return { item, loadingMore: detail.loading }
  return { item: backendDetailToNewsItem(detail.data), loadingMore: false }
}

export default function NewsDetailScreen({ route, navigation }: Props) {
  const { isBookmarked, toggleBookmark } = useSettings()
  const { item, loadingMore } = useEnhancedNewsItem(route.params.item)
  const catColor = CATEGORY_COLORS[item.category as CategoryKey]
  const bookmarked = isBookmarked(item.id)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>소식 상세</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => toggleBookmark(item.id)}
          accessibilityLabel={bookmarked ? '북마크 해제' : '북마크'}
        >
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={19}
            color={bookmarked ? COLORS.primary : COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: catColor?.bg }]}>
            <Text style={[styles.badgeText, { color: catColor?.text }]}>{item.category}</Text>
          </View>
          <Text style={styles.date}>
            {item.date}
            {typeof item.views === 'number' ? ` · 조회 ${item.views}` : ''}
          </Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>

        <View style={styles.sourceRow}>
          <Ionicons name="business-outline" size={14} color="#bbb" />
          <Text style={styles.sourceName}>{item.source}</Text>
        </View>

        <View style={styles.divider} />

        {loadingMore && (
          <View style={styles.bodyLoading}>
            <ActivityIndicator size="small" color="#bbb" />
            <Text style={styles.bodyLoadingText}>본문을 불러오는 중…</Text>
          </View>
        )}

        {item.preview.length > 0 && <Text style={styles.body}>{item.preview}</Text>}

        {/* 크롤러가 목록만 긁었거나 본문이 이미지뿐이면 미리보기가 비어 있다. */}
        {!loadingMore && item.preview.length === 0 && (
          <Text style={styles.bodyPlaceholder}>
            {item.images?.length
              ? '본문이 이미지로만 되어 있습니다. 원문에서 확인하세요.'
              : '본문 미리보기가 없습니다. 원문에서 확인하세요.'}
          </Text>
        )}

        {item.attachments && item.attachments.length > 0 && (
          <View style={styles.attachBox}>
            <Text style={styles.attachLabel}>첨부파일 {item.attachments.length}</Text>
            {item.attachments.map((file) => (
              <TouchableOpacity
                key={file.url}
                style={styles.attachRow}
                onPress={() => Linking.openURL(file.url)}
                accessibilityRole="link"
                accessibilityLabel={`${file.name} 내려받기`}
              >
                <Ionicons name="document-attach-outline" size={15} color={COLORS.primary} />
                <Text style={styles.attachName} numberOfLines={1}>{file.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() =>
            Linking.openURL(item.link ?? 'https://www.hongik.ac.kr')
          }
        >
          <Ionicons name="open-outline" size={16} color={COLORS.primary} />
          <Text style={styles.linkText}>
            {item.link ? '원문 보기' : '원문 보기 (홍익대 홈페이지)'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: FONTS.semibold },
  date: { fontFamily: FONTS.regular, fontSize: 12, color: '#bbb' },
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
    marginBottom: 16,
  },
  sourceName: { fontSize: 13, color: COLORS.textSecondary, fontFamily: FONTS.medium },
  divider: { height: 0.5, backgroundColor: '#eee', marginBottom: 20 },
  bodyLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  bodyLoadingText: { fontFamily: FONTS.regular, fontSize: 13, color: '#bbb' },
  body: { fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
    marginBottom: 12,
  },
  bodyPlaceholder: { fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#bbb',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  attachBox: {
    backgroundColor: '#FAFAFC',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  attachLabel: { fontSize: 11, fontFamily: FONTS.bold, color: '#9a9aa5', letterSpacing: 0.3 },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  attachName: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: COLORS.primary },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#EEF0FA',
  },
  linkText: { fontSize: 14, color: COLORS.primary, fontFamily: FONTS.medium },
})
