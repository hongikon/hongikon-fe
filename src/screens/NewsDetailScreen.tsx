import { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, CATEGORY_COLORS } from '../constants/colors'
import { SPACING } from '../constants/spacing'
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
import { ModalPanel } from '../components/settings/ModalHeader'
import IconButton from '../components/common/IconButton'
import Button from '../components/common/Button'
import { NewsDetailSkeleton, DetailBodySkeleton } from '../components/common/Skeleton'
import { useFeedbackToggles } from '../hooks/useFeedbackToggles'
import type { NewsItem } from '../types'
import { openExternalUrl } from '../utils/openExternalUrl'
import { formatNewsBody, splitLinks } from '../utils/newsBody'

type Props = NativeStackScreenProps<RootStackParamList, 'NewsDetail'>

/**
 * 목록 카드에서 온 `item`엔 짧은 preview만 있고 본문 전체·이미지·첨부파일은 없다
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
  // 웹에서 `/news/abc` 처럼 숫자가 아닌 id 로 들어오면 부를 API 가 없어, 예전엔 스켈레톤이 끝없이 돌았다.
  const notFound = !summary && backendId === null
  if (!fresh) return { item: summary, loadingMore: detail.loading || detail.refreshing, detail, notFound }
  return { item: backendDetailToNewsItem(fresh), loadingMore: false, detail, notFound }
}

export default function NewsDetailScreen({ route, navigation }: Props) {
  const { item, loadingMore, detail, notFound } = useEnhancedNewsItem(route.params)

  // 알림으로 들어와 아직 아무것도 없을 때: 받는 중이면 본문 모양의 스켈레톤, 실패하면 다시 시도 안내.
  if (!item) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="소식 상세" onBack={() => navigation.goBack()} card style={layoutStyles.readable} />
        <View style={[styles.column, layoutStyles.readable]}>
          <ModalPanel>
            {notFound ? (
              <RetryableError style={styles.loadError} message="소식을 찾을 수 없어요. 주소를 확인해 주세요." />
            ) : detail.errorMessage ? (
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
  const catColor = CATEGORY_COLORS[item.category as CategoryKey]
  const bookmarked = isBookmarked(item.id)
  const originalLabel = item.link ? '원문 보기' : '원문 보기 (홍익대 홈페이지)'
  const originalA11yLabel = item.link ? '원문 보기' : '원문 보기, 홍익대 홈페이지'
  const openOriginal = () => openExternalUrl(item.link, 'https://www.hongik.ac.kr')
  const insets = useSafeAreaInsets()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="소식 상세"
        onBack={onBack}
        card
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

      {/* 회색 바탕 위 둥근 흰 판에 본문을 담는다(10-07 — 설정 창들과 같은 모양). */}
      <View style={[styles.column, layoutStyles.readable]}>
        <ModalPanel>
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
          </ScrollView>
        </ModalPanel>
      </View>

      {/* 원문 보기는 화면 아래에 하나만 고정해 둔다 — 본문을 어디까지 읽었든 바로 누를 수 있다(예전엔 위·아래 두 개였다). */}
      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <View style={layoutStyles.readable}>
          <Button
            icon="open-outline"
            label={originalLabel}
            onPress={openOriginal}
            accessibilityRole="link"
            accessibilityLabel={originalA11yLabel}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  column: { flex: 1 },
  loadError: { margin: 16 },
  scroll: { flex: 1 },
  // 글자 왼쪽 끝을 28(판 바깥 12 + 안쪽 16)에 맞춘다(10-08).
  scrollContent: { paddingHorizontal: SPACING.lg, paddingVertical: 20 },
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
  // 원문 보기: 회색 바탕 위에 떠 있는 버튼만. 좌우 12 로 위 본문 판 가장자리와 맞춘다(10-08, 예전 흰 바 + 윗선 + 20).
  footer: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
  },
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

/**
 * 크롤러가 가져온 본문을 정리해 보여 준다(utils/newsBody). 소제목·항목(굵은 라벨)·주의 문구·문단으로 나누고,
 * 본문 속 링크·메일은 눌러 열 수 있게 한다. 글자는 원문 그대로다.
 */
function NewsBody({ text }: { text: string }) {
  const blocks = useMemo(() => formatNewsBody(text), [text])
  return (
    <View style={bodyStyles.wrap}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <Text key={index} style={bodyStyles.heading}>
              <Text style={bodyStyles.headingMarker}>{block.marker} </Text>
              <Inline text={block.text} />
            </Text>
          )
        }
        if (block.type === 'note') {
          return (
            <View key={index} style={bodyStyles.note}>
              <Text style={bodyStyles.noteText}>
                <Inline text={block.text} />
              </Text>
            </View>
          )
        }
        if (block.type === 'bullet') {
          return (
            <View key={index} style={[bodyStyles.bulletRow, block.depth === 1 && bodyStyles.bulletIndent]}>
              <Text style={bodyStyles.bulletMark}>{block.marker ?? '•'}</Text>
              <Text style={bodyStyles.bulletText}>
                {block.label ? <Text style={bodyStyles.label}>{`${block.label}  `}</Text> : null}
                <Inline text={block.text} />
              </Text>
            </View>
          )
        }
        return (
          <Text key={index} style={bodyStyles.paragraph}>
            <Inline text={block.text} />
          </Text>
        )
      })}
    </View>
  )
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.kind === 'link' ? (
          <Text
            key={i}
            style={bodyStyles.link}
            onPress={() => openExternalUrl(part.url)}
            accessibilityRole="link"
          >
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        ),
      )}
    </>
  )
}

const bodyStyles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 16 },
  paragraph: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 24, color: COLORS.textPrimary },
  heading: { fontFamily: FONTS.bold, fontSize: 15.5, lineHeight: 23, color: COLORS.textPrimary, marginTop: 8 },
  headingMarker: { color: COLORS.primary },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletIndent: { paddingLeft: 14 },
  bulletMark: { fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 23, color: COLORS.primary, minWidth: 10 },
  bulletText: { flex: 1, fontFamily: FONTS.regular, fontSize: 15, lineHeight: 23, color: COLORS.textPrimary },
  label: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  note: { backgroundColor: COLORS.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  noteText: { fontFamily: FONTS.regular, fontSize: 13.5, lineHeight: 20, color: COLORS.textSecondary },
  link: { color: COLORS.primary, textDecorationLine: 'underline' },
})
