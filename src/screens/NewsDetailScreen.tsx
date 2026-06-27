import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, CATEGORY_COLORS } from '../constants/colors'
import type { CategoryKey } from '../constants/colors'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'NewsDetail'>

export default function NewsDetailScreen({ route, navigation }: Props) {
  const { item } = route.params
  const catColor = CATEGORY_COLORS[item.category as CategoryKey]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>소식 상세</Text>
        <View style={{ width: 34 }} />
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
          onPress={() => Linking.openURL('https://www.hongik.ac.kr')}
        >
          <Ionicons name="open-outline" size={16} color={COLORS.primary} />
          <Text style={styles.linkText}>원문 보기 (홍익대 홈페이지)</Text>
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
  headerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  date: { fontSize: 12, color: '#bbb' },
  title: {
    fontSize: 20,
    fontWeight: '700',
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
  sourceName: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  divider: { height: 0.5, backgroundColor: '#eee', marginBottom: 20 },
  body: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
    marginBottom: 12,
  },
  bodyPlaceholder: {
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
  linkText: { fontSize: 14, color: COLORS.primary, fontWeight: '500' },
})
