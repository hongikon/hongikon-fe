import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { getErrorMessage, isCancelledError } from '../../apis/client'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { fetchAskFeedback, reviewAskFeedback } from '../api'
import { formatDateTime, formatRelative } from '../format'
import type { AdminAskFeedbackItem, AdminAskFeedbackResponse, AskFeedbackFilter, AskFeedbackReasonCode } from '../types'
import { Badge, Button, Card, EmptyState, FilterTabs, InlineError, Loading, ScreenHeader, type Tone } from '../ui'
import { AskNoteForm, AskNotesView, AskReportView } from './AskInsightViews'

const REASON_LABELS: Record<AskFeedbackReasonCode | 'NONE', string> = {
  WRONG: '틀린 정보',
  OUTDATED: '지난 정보',
  OFF_TOPIC: '질문과 다름',
  NOT_ENOUGH: '부족함',
  NONE: '이유 안 고름',
}
const REASON_TONES: Record<AskFeedbackReasonCode, Tone> = {
  WRONG: 'danger',
  OUTDATED: 'warning',
  OFF_TOPIC: 'info',
  NOT_ENOUGH: 'neutral',
}
const DAY_OPTIONS = [
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
  { value: '90', label: '90일' },
] as const

type ReasonFilter = AskFeedbackReasonCode | 'NONE' | 'ALL'

/**
 * 물어보기에서 학생이 '해결 안 됨'을 누른 답(11-06). 이유·질문·답·근거와, 같은 답에서 보낸 '운영진에게 물어보기' 문의(남긴 말·사진)를
 * 함께 본다. 고친 뒤 '확인함'으로 넘긴다. 답장이 필요하면 문의 탭에서 처리한다(연락처·처리 완료는 문의 쪽).
 */
export default function AskFeedbackScreen() {
  const [view, setView] = useState<'feedback' | 'report' | 'notes'>('feedback')
  const [draftQuestion, setDraftQuestion] = useState<string | null>(null)
  const viewTabs = (
    <FilterTabs
      options={[
        { value: 'feedback' as const, label: '피드백' },
        { value: 'report' as const, label: '주간 요약' },
        { value: 'notes' as const, label: '운영진 안내' },
      ]}
      value={view}
      onChange={setView}
    />
  )
  if (view === 'report' || view === 'notes') {
    return (
      <View>
        <ScreenHeader
          title="물어보기 피드백"
          subtitle={
            view === 'report'
              ? "'해결 안 됨'을 같은 안내·비슷한 질문끼리 묶어 많은 순으로 보여 줘요. 서버 안에서만 센 값이에요."
              : '운영진이 확인해 적은 답이에요. 물어보기가 비슷한 질문에 이 답을 근거로 함께 읽어요.'
          }
        />
        {viewTabs}
        <View style={styles.row}>
          {view === 'report' ? (
            <AskReportView
              onWriteNote={(question) => {
                setDraftQuestion(question)
                setView('notes')
              }}
            />
          ) : (
            <AskNotesView draftQuestion={draftQuestion} onDraftDone={() => setDraftQuestion(null)} />
          )}
        </View>
      </View>
    )
  }
  return <FeedbackList tabs={viewTabs} />
}

function FeedbackList({ tabs }: { tabs: ReactNode }) {
  const [filter, setFilter] = useState<AskFeedbackFilter>('OPEN')
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]['value']>('30')
  const [reason, setReason] = useState<ReasonFilter>('ALL')
  const [data, setData] = useState<AdminAskFeedbackResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchAskFeedback(filter, Number(days), controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(getErrorMessage(err, '물어보기 피드백을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [filter, days, reloadKey])

  const items = useMemo(
    () => (data?.items ?? []).filter((item) => reason === 'ALL' || (item.reason ?? 'NONE') === reason),
    [data, reason],
  )

  const markReviewed = (item: AdminAskFeedbackItem, reviewed: boolean) =>
    reviewAskFeedback(item.source, item.id, reviewed).then(() =>
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((row) =>
                row.source === item.source && row.id === item.id ? { ...row, reviewedAt: reviewed ? new Date().toISOString() : null } : row,
              ),
            }
          : prev,
      ),
    )

  const reasonChips: { value: ReasonFilter; label: string; count?: number }[] = [
    { value: 'ALL', label: '전체', count: data?.items.length },
    ...(['WRONG', 'OUTDATED', 'OFF_TOPIC', 'NOT_ENOUGH', 'NONE'] as const).map((code) => ({
      value: code,
      label: REASON_LABELS[code],
      count: data?.reasons[code] ?? 0,
    })),
  ]

  return (
    <View>
      <ScreenHeader
        title="물어보기 피드백"
        subtitle="학생이 '해결 안 됨'을 누른 답이에요. 최신순 최대 200건. 고친 뒤 '확인함'을 누르세요."
        right={<Button label="새로고침" icon="refresh" onPress={() => setReloadKey((key) => key + 1)} loading={loading && !!data} small />}
      />
      {tabs}
      <View style={styles.row} />
      <FilterTabs
        options={[
          { value: 'OPEN' as const, label: '확인 전' },
          { value: 'REVIEWED' as const, label: '확인함' },
          { value: 'ALL' as const, label: '전체' },
        ]}
        value={filter}
        onChange={(next) => {
          if (next === filter) return
          setData(null)
          setFilter(next)
        }}
      />
      <View style={styles.row}>
        <FilterTabs
          options={DAY_OPTIONS}
          value={days}
          onChange={(next) => {
            if (next === days) return
            setData(null)
            setDays(next)
          }}
        />
      </View>
      <View style={styles.chips}>
        {reasonChips.map((chip) => {
          const selected = chip.value === reason
          return (
            <Pressable
              key={chip.value}
              onPress={() => setReason(chip.value)}
              style={[styles.chip, selected && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {chip.label}
                {chip.count !== undefined ? ` ${chip.count}` : ''}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {error ? <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} style={styles.listError} /> : null}
      {!data ? (
        loading ? <Loading /> : null
      ) : items.length === 0 ? (
        <EmptyState message={filter === 'OPEN' ? '확인할 피드백이 없습니다.' : '해당하는 피드백이 없습니다.'} />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <AskFeedbackCard key={`${item.source}-${item.id}`} item={item} onReview={markReviewed} />
          ))}
        </View>
      )}
    </View>
  )
}

function AskFeedbackCard({
  item,
  onReview,
}: {
  item: AdminAskFeedbackItem
  onReview: (item: AdminAskFeedbackItem, reviewed: boolean) => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [writing, setWriting] = useState(false)
  const [noted, setNoted] = useState(false)
  const reviewed = item.reviewedAt !== null

  const toggle = () => {
    setPending(true)
    setError(null)
    onReview(item, !reviewed)
      .catch((err: unknown) => setError(getErrorMessage(err, '상태를 바꾸지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setPending(false))
  }

  return (
    <Card style={[styles.card, reviewed && styles.cardReviewed]}>
      <View style={styles.top}>
        <View style={styles.badges}>
          {item.reason ? (
            <Badge label={REASON_LABELS[item.reason]} tone={REASON_TONES[item.reason]} />
          ) : (
            <Badge label={REASON_LABELS.NONE} />
          )}
          <Badge label={item.source === 'ROUTE' ? '서버 답' : '안내 흐름'} tone="info" />
          {item.handoffs.length > 0 ? <Badge label={`문의 ${item.handoffs.length}`} tone="warning" /> : null}
          {reviewed ? <Badge label="확인함" tone="success" /> : null}
        </View>
        <Text style={styles.meta}>
          {formatDateTime(item.createdAt)} ({formatRelative(item.createdAt)})
        </Text>
      </View>

      <Text selectable style={styles.question}>
        Q. {item.question}
      </Text>
      {item.answer ? (
        <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityLabel={open ? '답 접기' : '답 펼치기'}>
          <Text selectable style={styles.answer} numberOfLines={open ? undefined : 5}>
            {item.answer}
          </Text>
          {item.answer.length > 240 ? <Text style={styles.more}>{open ? '접기' : '펼치기'}</Text> : null}
        </Pressable>
      ) : null}

      <View style={styles.facts}>
        {item.flowId ? (
          <Text selectable style={styles.fact}>
            안내 <Text style={styles.factStrong}>{item.flowId}/{item.nodeId ?? '-'}</Text>
          </Text>
        ) : null}
        {item.nodeIds.length > 0 ? (
          <Text selectable style={styles.fact}>
            고른 안내 <Text style={styles.factStrong}>{item.nodeIds.join(', ')}</Text>
          </Text>
        ) : null}
        {item.references.length > 0 ? (
          <Text selectable style={styles.fact}>
            근거 <Text style={styles.factStrong}>{item.references.join(' · ')}</Text>
          </Text>
        ) : null}
        <Text style={styles.fact}>
          #{item.source === 'ROUTE' ? 'R' : 'F'}
          {item.id}
        </Text>
      </View>

      {item.handoffs.map((handoff) => (
        <View key={handoff.feedbackId} style={styles.handoff}>
          <Text style={styles.handoffTitle}>
            운영진에게 물어보기 · 문의 #{handoff.feedbackId} · {handoff.status === 'RESOLVED' ? '처리 완료' : '미처리'}
          </Text>
          <Text selectable style={styles.handoffText}>
            {handoff.content}
          </Text>
          {handoff.contact ? (
            <Text selectable style={styles.fact}>
              연락처 <Text style={styles.factStrong}>{handoff.contact}</Text>
            </Text>
          ) : null}
          {handoff.imageUrls.length > 0 ? (
            <View style={styles.images}>
              {handoff.imageUrls.map((url, index) => (
                <Pressable
                  key={url}
                  onPress={() => Linking.openURL(url).catch(() => {})}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`참고 사진 ${index + 1} 크게 보기`}
                >
                  <Image source={{ uri: url }} style={styles.image} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ))}

      {writing ? (
        <AskNoteForm
          initialQuestion={item.question}
          askRef={item.source === 'ROUTE' ? `route:${item.id}` : null}
          onSaved={() => {
            setWriting(false)
            setNoted(true)
          }}
          onCancel={() => setWriting(false)}
        />
      ) : null}
      {noted ? <Text style={styles.fact}>운영진 확인 안내로 등록했어요. '운영진 안내'에서 고치거나 끌 수 있어요.</Text> : null}
      <View style={styles.actions}>
        {!writing ? <Button label="안내로 등록" icon="add" onPress={() => setWriting(true)} small /> : null}
        <Button
          label={reviewed ? '되돌리기' : '확인함'}
          icon={reviewed ? 'arrow-undo-outline' : 'checkmark'}
          variant={reviewed ? 'secondary' : 'primary'}
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
  row: { marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 12 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
  },
  chipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  chipText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  chipTextOn: { color: COLORS.white },
  listError: { marginBottom: 12 },
  list: { gap: 12 },
  card: { gap: 10 },
  cardReviewed: { opacity: 0.75 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  question: { fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 22, color: COLORS.textPrimary },
  answer: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.textPrimary },
  more: { marginTop: 2, fontFamily: FONTS.medium, fontSize: 12, color: COLORS.primary },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  fact: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  factStrong: { fontFamily: FONTS.medium, color: COLORS.textPrimary },
  handoff: { gap: 6, padding: 10, borderRadius: 10, backgroundColor: COLORS.background },
  handoffTitle: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textSecondary },
  handoffText: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: COLORS.textPrimary },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  image: { width: 88, height: 88, borderRadius: 8, backgroundColor: COLORS.border },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
})
