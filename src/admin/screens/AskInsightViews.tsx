import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { getErrorMessage, isCancelledError } from '../../apis/client'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { fetchAskNotes, fetchAskReport, updateAskNote } from '../api'
import { formatDateTime } from '../format'
import type { AdminAskNote, AdminAskReport } from '../types'
import { AskNoteForm } from '../components/ask/AskNoteForm'
import { Badge, Button, Card, EmptyState, FilterTabs, InlineError, Loading } from '../ui'
import { askReasonText, upsertAskNote } from '../utils/askFeedback'

export { AskNoteForm } from '../components/ask/AskNoteForm'

/**
 * 주간 요약(11-06): 기간 동안 '해결 안 됨'을 같은 안내끼리, 안내를 못 고른 질문은 비슷한 것끼리 묶어 많은 순으로 보여 준다.
 * 서버 안에서만 센 값이다. 많이 걸린 묶음부터 안내를 고치거나 '안내로 등록'으로 답을 보탠다.
 */
export function AskReportView({ onWriteNote }: { onWriteNote: (question: string) => void }) {
  const [days, setDays] = useState<'7' | '30'>('7')
  const [report, setReport] = useState<AdminAskReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetchAskReport(Number(days), controller.signal)
      .then(setReport)
      .catch((err: unknown) => {
        if (!isCancelledError(err)) setError(getErrorMessage(err, '요약을 불러오지 못했습니다.'))
      })
    return () => controller.abort()
  }, [days, reloadKey])

  const answered = report ? report.resolvedYes + report.resolvedNo : 0
  return (
    <View style={styles.gap}>
      <FilterTabs
        options={[
          { value: '7' as const, label: '지난 7일' },
          { value: '30' as const, label: '지난 30일' },
        ]}
        value={days}
        onChange={(next) => {
          if (next === days) return
          setReport(null)
          setDays(next)
        }}
      />
      {error ? <InlineError message={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}
      {!report ? (
        error ? null : <Loading />
      ) : (
        <>
          <Card style={styles.summary}>
            <Text style={styles.summaryLine}>
              서버 답 <Text style={styles.strong}>{report.questions}</Text>건 · 해결됐나요 응답 {answered}건 중 해결 안 됨{' '}
              <Text style={styles.strong}>{report.resolvedNo}</Text>건
              {answered > 0 ? ` (${Math.round((100 * report.resolvedNo) / answered)}%)` : ''}
            </Text>
            {report.resolvedNo > 0 ? <Text style={styles.meta}>이유: {askReasonText(report.reasons)}</Text> : null}
          </Card>
          {report.groups.length === 0 ? (
            <EmptyState message="이 기간에 해결 안 됨이 없습니다." />
          ) : (
            report.groups.map((group) => (
              <Card key={`${group.kind}-${group.key}`} style={styles.card}>
                <View style={styles.row}>
                  <Badge label={group.kind === 'GUIDE' ? '같은 안내' : '안내 못 찾음'} tone={group.kind === 'GUIDE' ? 'info' : 'warning'} />
                  <Text style={styles.count}>
                    {group.count}건{group.open < group.count ? ` (확인 전 ${group.open})` : ''}
                  </Text>
                </View>
                <Text selectable style={styles.title}>
                  {group.label}
                </Text>
                {group.kind === 'GUIDE' ? (
                  <Text selectable style={styles.meta}>
                    {group.key}
                  </Text>
                ) : null}
                <Text style={styles.meta}>{askReasonText(group.reasons)}</Text>
                {group.questions.map((q) => (
                  <Text key={q} selectable style={styles.question}>
                    · {q}
                  </Text>
                ))}
                <View style={styles.actions}>
                  <Button label="안내로 등록" icon="add" onPress={() => onWriteNote(group.questions[0] ?? group.label)} small />
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </View>
  )
}

/** 등록한 운영진 확인 안내 목록. 지우지 않고 끈다(언제 무엇을 답했는지 남긴다). */
export function AskNotesView({ draftQuestion, onDraftDone }: { draftQuestion: string | null; onDraftDone: () => void }) {
  const [notes, setNotes] = useState<AdminAskNote[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | 'new' | null>(draftQuestion !== null ? 'new' : null)
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<'ON' | 'ALL'>('ON')

  useEffect(() => {
    if (draftQuestion !== null) setEditing('new')
  }, [draftQuestion])

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetchAskNotes(controller.signal)
      .then(setNotes)
      .catch((err: unknown) => {
        if (!isCancelledError(err)) setError(getErrorMessage(err, '안내 목록을 불러오지 못했습니다.'))
      })
    return () => controller.abort()
  }, [reloadKey])

  const saved = (note: AdminAskNote) => {
    setNotes((prev) => upsertAskNote(prev, note))
    setEditing(null)
    onDraftDone()
  }

  const toggle = (note: AdminAskNote) =>
    updateAskNote(note.id, { active: !note.active })
      .then(saved)
      .catch((err: unknown) => setError(getErrorMessage(err, '바꾸지 못했습니다.')))

  const shown = (notes ?? []).filter((note) => filter === 'ALL' || note.active)
  return (
    <View style={styles.gap}>
      <View style={styles.row}>
        <FilterTabs
          options={[
            { value: 'ON' as const, label: '켜진 안내' },
            { value: 'ALL' as const, label: '전체' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {editing === null ? <Button label="새 안내" icon="add" onPress={() => setEditing('new')} small /> : null}
      </View>
      {editing === 'new' ? (
        <Card>
          <AskNoteForm
            initialQuestion={draftQuestion ?? ''}
            onSaved={saved}
            onCancel={() => {
              setEditing(null)
              onDraftDone()
            }}
          />
        </Card>
      ) : null}
      {error ? <InlineError message={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}
      {!notes ? (
        error ? null : <Loading />
      ) : shown.length === 0 ? (
        <EmptyState message="등록한 안내가 없습니다. 피드백이나 주간 요약에서 '안내로 등록'을 누르세요." />
      ) : (
        shown.map((note) => (
          <Card key={note.id} style={[styles.card, !note.active && styles.off]}>
            {editing === note.id ? (
              <AskNoteForm note={note} onSaved={saved} onCancel={() => setEditing(null)} />
            ) : (
              <>
                <View style={styles.row}>
                  <Badge label={note.active ? '켜짐' : '꺼짐'} tone={note.active ? 'success' : 'neutral'} />
                  <Text style={styles.meta}>
                    #{note.id} · {formatDateTime(note.updatedAt)}
                  </Text>
                </View>
                <Text selectable style={styles.title}>
                  Q. {note.question}
                </Text>
                <Text selectable style={styles.answer}>
                  {note.answer}
                </Text>
                <View style={styles.actions}>
                  <Button label="고치기" icon="create-outline" onPress={() => setEditing(note.id)} small />
                  <Button label={note.active ? '끄기' : '켜기'} onPress={() => toggle(note)} small />
                </View>
              </>
            )}
          </Card>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  summary: { gap: 6 },
  summaryLine: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.textPrimary },
  strong: { fontFamily: FONTS.semibold },
  card: { gap: 8 },
  off: { opacity: 0.6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  count: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  title: { fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 22, color: COLORS.textPrimary },
  answer: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.textPrimary },
  question: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, color: COLORS.textSecondary },
  meta: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
})
