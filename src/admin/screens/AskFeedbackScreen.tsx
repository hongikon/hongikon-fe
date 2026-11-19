import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { AskFeedbackCard } from '../components/ask/AskFeedbackCard'
import { useAskFeedbackList } from '../hooks/useAskFeedbackList'
import { Button, EmptyState, FilterTabs, InlineError, Loading, ScreenHeader } from '../ui'
import { ASK_DAY_OPTIONS, reasonChipOptions } from '../utils/askFeedback'
import { AskNotesView, AskReportView } from './AskInsightViews'

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

/** '피드백' 보기: 확인 상태·기간·이유로 거른 목록. */
function FeedbackList({ tabs }: { tabs: ReactNode }) {
  const { filter, days, reason, setReason, data, loading, error, reload, items, changeFilter, changeDays, markReviewed } =
    useAskFeedbackList()
  const reasonChips = reasonChipOptions(data)

  return (
    <View>
      <ScreenHeader
        title="물어보기 피드백"
        subtitle="학생이 '해결 안 됨'을 누른 답이에요. 최신순 최대 200건. 고친 뒤 '확인함'을 누르세요."
        right={<Button label="새로고침" icon="refresh" onPress={reload} loading={loading && !!data} small />}
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
        onChange={changeFilter}
      />
      <View style={styles.row}>
        <FilterTabs
          options={ASK_DAY_OPTIONS}
          value={days}
          onChange={changeDays}
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

      {error ? <InlineError message={error} onRetry={reload} style={styles.listError} /> : null}
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
})
