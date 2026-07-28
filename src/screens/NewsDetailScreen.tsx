import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, CATEGORY_COLORS } from '../constants/colors'
import type { CategoryKey } from '../constants/colors'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useSettings } from '../contexts/SettingsContext'
import { FONTS } from '../constants/typography'

type Props = NativeStackScreenProps<RootStackParamList, 'NewsDetail'>

export default function NewsDetailScreen({ route, navigation }: Props) {
  const { item } = route.params
  const { isBookmarked, toggleBookmark } = useSettings()
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
          <Text style={styles.date}>2024.{item.date}</Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>

        <View style={styles.sourceRow}>
          <Ionicons name="business-outline" size={14} color="#bbb" />
          <Text style={styles.sourceName}>{item.source}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.body}>{item.preview}</Text>
        <Text style={styles.bodyPlaceholder}>
          실제 공지 내용은 백엔드 연동 후 표시됩니다.
        </Text>

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
