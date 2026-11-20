import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { CATEGORY_COLORS, COLORS, type CategoryKey } from '../../../constants/colors'
import { RADIUS, SPACING } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { DetailBodySkeleton } from '../../common/Skeleton'
import { emptyBodyMessage } from '../../../utils/news/detail'
import type { NewsItem } from '../../../types'
import NewsBody from './NewsBody'
import NewsAttachments from './NewsAttachments'

interface Props {
  item: NewsItem
  /** 상세 API 로 본문을 받는 중. 그동안은 목록에서 온 짧은 미리보기 대신 본문 자리 모양을 보여 준다. */
  loadingMore: boolean
}

/**
 * [소식 상세 본문] 분야·날짜, 출처, 제목, 본문(또는 받는 중 모양·빈 본문 안내), 첨부파일을 스크롤 안에 담는다.
 * 둥근 흰 판(ModalPanel) 안에 넣어 쓴다.
 */
export default function NewsDetailArticle({ item, loadingMore }: Props) {
  const catColor = CATEGORY_COLORS[item.category as CategoryKey]
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.metaRow}>
        <View style={[styles.badge, { backgroundColor: catColor?.bg }]}>
          <Text style={[styles.badgeText, { color: catColor?.text }]}>{item.category}</Text>
        </View>
        {/* 학교 홈페이지 조회수는 보여 주지 않는다(10-08 요청). */}
        <Text style={styles.date}>{item.date}</Text>
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

      <View style={styles.divider} />

      {/* 목록에서 온 짧은 미리보기 대신 본문 자리 모양을 보여주고, 다 받으면 본문으로 바꾼다. */}
      {loadingMore ? (
        <DetailBodySkeleton />
      ) : (
        item.preview.length > 0 && <NewsBody text={item.preview} />
      )}

      {/* 크롤러가 목록만 긁었거나 본문이 이미지뿐이면 미리보기가 비어 있다. */}
      {!loadingMore && item.preview.length === 0 && (
        <Text style={styles.bodyPlaceholder}>{emptyBodyMessage(item.images?.length)}</Text>
      )}

      <NewsAttachments attachments={item.attachments} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  // 글자 왼쪽 끝을 28(판 바깥 12 + 안쪽 16)에 맞춘다(10-08).
  scrollContent: { paddingHorizontal: SPACING.lg, paddingVertical: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  badgeText: { fontSize: 12, fontFamily: FONTS.semibold },
  date: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
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
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginBottom: 20 },
  bodyPlaceholder: { fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textTertiary,
    marginBottom: 24,
  },
})
