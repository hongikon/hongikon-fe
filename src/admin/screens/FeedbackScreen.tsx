import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { getErrorMessage, isCancelledError } from '../../apis/client'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { fetchFeedback, updateFeedbackStatus } from '../api'
import { formatDateTime, formatMemberRef, formatRelative } from '../format'
import type { AdminFeedback, AdminOverview, FeedbackStatusFilter } from '../types'
import { Badge, Button, Card, EmptyState, FilterTabs, InlineError, Loading, ScreenHeader } from '../ui'
import { INFO_SUGGESTION_BADGES, OFFICIAL_REQUEST_PREFIX, infoSuggestTypeOf } from '../../constants/feedback'

/** 앱 설정 > 문의하기로 들어온 의견. 처리 완료/다시 열기만 한다(답장은 연락처로 직접). */
export default function FeedbackScreen({
  onChanged,
  overview,
  focusFeedbackId = null,
}: {
  onChanged: () => void
  overview: AdminOverview | null
  /** 관리자 알림으로 연 문의. 목록에 있으면 맨 위로 올려 강조한다. */
  focusFeedbackId?: number | null
}) {
  const [filter, setFilter] = useState<FeedbackStatusFilter>('OPEN')
  const [items, setItems] = useState<AdminFeedback[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchFeedback(filter, controller.signal)
      .then(setItems)
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(getErrorMessage(err, '문의 목록을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [filter, reloadKey])

  const changeFilter = (next: FeedbackStatusFilter) => {
    if (next === filter) return
    setItems(null)
    setFilter(next)
  }

  const handleUpdated = useCallback(
    (updated: AdminFeedback) => {
      setItems((prev) => prev?.map((item) => (item.id === updated.id ? updated : item)) ?? prev)
      onChanged()
    },
    [onChanged],
  )

  const tabs = [
    { value: 'OPEN' as const, label: '미처리', count: overview?.feedback.open },
    { value: 'RESOLVED' as const, label: '처리 완료' },
    { value: 'ALL' as const, label: '전체' },
  ]

  return (
    <View>
      <ScreenHeader
        title="문의"
        subtitle="최신순 최대 200건. 답변이 필요하면 적힌 연락처로 직접 연락합니다."
        right={<Button label="새로고침" icon="refresh" onPress={() => setReloadKey((key) => key + 1)} loading={loading && !!items} small />}
      />
      <FilterTabs options={tabs} value={filter} onChange={changeFilter} />

      {error ? <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} style={styles.listError} /> : null}
      {!items ? (
        loading ? <Loading /> : null
      ) : items.length === 0 ? (
        <EmptyState message={filter === 'OPEN' ? '미처리 문의가 없습니다.' : '해당하는 문의가 없습니다.'} />
      ) : (
        <View style={styles.list}>
          {withFocusedFirst(items, focusFeedbackId).map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              movedOut={filter !== 'ALL' && item.status !== filter}
              highlighted={item.id === focusFeedbackId}
              onUpdated={handleUpdated}
            />
          ))}
        </View>
      )}
    </View>
  )
}

/** 알림으로 연 항목을 맨 위로(나머지 순서는 그대로). */
function withFocusedFirst<T extends { id: number }>(items: T[], focusId: number | null): T[] {
  if (focusId === null) return items
  const focused = items.find((item) => item.id === focusId)
  return focused ? [focused, ...items.filter((item) => item !== focused)] : items
}

function FeedbackCard({
  item,
  movedOut,
  highlighted = false,
  onUpdated,
}: {
  item: AdminFeedback
  movedOut: boolean
  highlighted?: boolean
  onUpdated: (item: AdminFeedback) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resolved = item.status === 'RESOLVED'
  // 설정 > 정보 제보하기로 들어온 문의면 종류(제휴·전시·행사·시설 정보·기타)를 표시한다.
  const suggestType = infoSuggestTypeOf(item.content)

  const toggle = () => {
    setPending(true)
    setError(null)
    updateFeedbackStatus(item.id, resolved ? 'OPEN' : 'RESOLVED')
      .then(onUpdated)
      .catch((err: unknown) => setError(getErrorMessage(err, '상태를 바꾸지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setPending(false))
  }

  return (
    <Card style={[styles.card, highlighted && styles.cardHighlighted, movedOut && styles.cardMoved]}>
      <View style={styles.top}>
        <View style={styles.badges}>
          <Badge label={resolved ? '처리 완료' : '미처리'} tone={resolved ? 'success' : 'warning'} />
          {suggestType !== null ? <Badge label={INFO_SUGGESTION_BADGES[suggestType]} tone="info" /> : null}
          {item.content.startsWith(OFFICIAL_REQUEST_PREFIX) ? <Badge label="공식 계정 신청" tone="info" /> : null}
          {movedOut ? <Badge label="방금 처리함" tone="info" /> : null}
        </View>
        <Text style={styles.meta}>#{item.id}</Text>
      </View>

      <Text selectable style={styles.content}>
        {item.content}
      </Text>

      <View style={styles.facts}>
        <Text style={styles.fact}>
          {/* 표시 이름 + 회원 번호만. userNickname(예전 서버는 로그인 닉네임 원문)은 쓰지 않는다. */}
          작성자{' '}
          <Text style={styles.factStrong}>
            {item.userId !== null ? formatMemberRef(item.userDisplayName, item.userMemberCode, item.userId) : '비로그인'}
          </Text>
        </Text>
        <Text style={styles.fact}>
          연락처 <Text selectable style={styles.factStrong}>{item.contact ?? '없음'}</Text>
        </Text>
        <Text style={styles.fact}>
          접수 {formatDateTime(item.createdAt)} ({formatRelative(item.createdAt)})
        </Text>
        {item.resolvedAt ? <Text style={styles.fact}>처리 {formatDateTime(item.resolvedAt)}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={resolved ? '다시 열기' : '처리 완료'}
          icon={resolved ? 'arrow-undo-outline' : 'checkmark'}
          variant={resolved ? 'secondary' : 'primary'}
          onPress={toggle}
          loading={pending}
          small
        />
      </View>
      {error ? <InlineError message={error} /> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  listError: { marginBottom: 12 },
  list: { gap: 12 },
  card: { gap: 10 },
  cardMoved: { opacity: 0.7, borderStyle: 'dashed' },
  cardHighlighted: { borderColor: COLORS.primary, borderWidth: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  content: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: COLORS.textPrimary },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  fact: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  factStrong: { fontFamily: FONTS.medium, color: COLORS.textPrimary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
})
