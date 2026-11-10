import { useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { getErrorMessage, isCancelledError } from '../../apis/client'
import { COLORS } from '../../constants/colors'
import { RADIUS } from '../../constants/spacing'
import { FONTS } from '../../constants/typography'
import { createAskNote, fetchAskNotes, fetchAskReport, updateAskNote } from '../api'
import { formatDateTime } from '../format'
import type { AdminAskNote, AdminAskReport } from '../types'
import { Badge, Button, Card, EmptyState, FilterTabs, InlineError, Loading } from '../ui'

const REASON_LABELS: Record<string, string> = {
  WRONG: '틀린 정보',
  OUTDATED: '지난 정보',
  OFF_TOPIC: '질문과 다름',
  NOT_ENOUGH: '부족함',
  NONE: '이유 안 고름',
}

const reasonText = (reasons: Record<string, number>) =>
  Object.entries(reasons)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => `${REASON_LABELS[code] ?? code} ${n}`)
    .join(' · ')

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
            {report.resolvedNo > 0 ? <Text style={styles.meta}>이유: {reasonText(report.reasons)}</Text> : null}
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
                <Text style={styles.meta}>{reasonText(group.reasons)}</Text>
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

/**
 * 운영진 확인 안내 쓰기. 물어보기가 비슷한 질문에 답할 때 이 글을 근거로 함께 읽는다.
 * 학생 개인 정보(휴대전화·주민번호·학번)는 서버가 거절한다.
 */
export function AskNoteForm({
  initialQuestion = '',
  askRef = null,
  note = null,
  onSaved,
  onCancel,
}: {
  initialQuestion?: string
  askRef?: string | null
  note?: AdminAskNote | null
  onSaved: (note: AdminAskNote) => void
  onCancel: () => void
}) {
  const [question, setQuestion] = useState(note?.question ?? initialQuestion)
  const [answer, setAnswer] = useState(note?.answer ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!question.trim() || !answer.trim()) {
      setError('질문과 답을 모두 적어 주세요.')
      return
    }
    setPending(true)
    setError(null)
    const request = note
      ? updateAskNote(note.id, { question: question.trim(), answer: answer.trim() })
      : createAskNote({ question: question.trim(), answer: answer.trim(), askRef })
    request
      .then(onSaved)
      .catch((err: unknown) => setError(getErrorMessage(err, '저장하지 못했습니다.')))
      .finally(() => setPending(false))
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{note ? '안내 고치기' : '운영진 확인 안내로 등록'}</Text>
      <Text style={styles.meta}>
        비슷한 질문이 오면 물어보기가 이 답을 근거로 써요. 여러 학생에게 똑같이 맞는 답만 적고, 학생 이름·학번·연락처 같은 개인 정보는 빼 주세요.
      </Text>
      <TextInput
        value={question}
        onChangeText={setQuestion}
        placeholder="질문 (예: T동 강의실 마이크는 어디서 빌려요?)"
        placeholderTextColor={COLORS.textPlaceholder}
        maxLength={200}
        style={styles.input}
        accessibilityLabel="안내 질문"
      />
      <TextInput
        value={answer}
        onChangeText={setAnswer}
        placeholder="답 (확인한 사실만, 필요하면 담당 부서·전화)"
        placeholderTextColor={COLORS.textPlaceholder}
        maxLength={2000}
        multiline
        style={[styles.input, styles.inputTall]}
        accessibilityLabel="안내 답"
      />
      {error ? <InlineError message={error} /> : null}
      <View style={styles.actions}>
        <Button label="취소" onPress={onCancel} small />
        <Button label="저장" icon="checkmark" variant="primary" onPress={save} loading={pending} small />
      </View>
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
    setNotes((prev) => (prev ? [note, ...prev.filter((item) => item.id !== note.id)].sort((a, b) => b.id - a.id) : [note]))
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
  form: { gap: 8 },
  formTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  inputTall: { minHeight: 110, textAlignVertical: 'top' },
})
