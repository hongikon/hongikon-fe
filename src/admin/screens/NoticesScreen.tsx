import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ApiError, getErrorMessage, isCancelledError } from '../../apis/client'
import { parseServerTime } from '../../utils/serverTime'
import { createAdminNotice, deleteAdminNotice, fetchAdminNotices, updateAdminNotice } from '../api'
import type { AdminNotice, AdminNoticeInput } from '../types'
import { Field, formStyles, OptionChips, TextRow, tooLong } from '../MapForm'
import { adminText, Badge, Button, Card, ConfirmBar, EmptyState, InlineError, Loading, ScreenHeader } from '../ui'

/**
 * 앱 공지 관리(11-09). 여기서 쓴 공지는 게시 시각부터 앱의 설정 > 공지사항에 보이고(`GET /notices`), 팝업을 켜면
 * 그 기간 동안 앱을 켤 때 한 번 뜬다(본 사람이 '다시 보지 않기'를 누르면 더는 안 뜬다). 시각은 모두 한국 시간으로 쓴다.
 * 앱에 적힌 예전 공지(constants/appNotices.ts)는 여기 나오지 않는다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS
/** 서버 규칙(AppNoticeService)과 같다. */
const MAX_POPUP_DAYS = 31
const KST_TIME_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/

/** epoch ms → 'YYYY-MM-DD HH:mm'(KST) */
function toKstInput(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ')
}

/** 'YYYY-MM-DD HH:mm'(KST) → epoch ms, 실제 날짜·시각이 아니면 null. */
function parseKstInput(value: string): number | null {
  const text = value.trim()
  const match = KST_TIME_RE.exec(text)
  if (!match) return null
  const ms = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00+09:00`)
  if (!Number.isFinite(ms) || toKstInput(ms) !== text) return null
  return ms
}

/** '11/10(화) 09:00' — 목록에 보이는 한국 시각. */
function formatKst(ms: number): string {
  const d = new Date(ms + KST_OFFSET_MS)
  const day = '일월화수목금토'[d.getUTCDay()]
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${day}) ${hh}:${mm}`
}

interface NoticeDraft {
  id: number | null
  title: string
  body: string
  publishAt: string
  popup: boolean
  popupUntil: string
  popupText: string
}

function emptyDraft(now: number): NoticeDraft {
  // 분 단위로 내림 — '지금'이 저장하는 사이 지나도 바로 게시된다.
  const start = Math.floor(now / MINUTE_MS) * MINUTE_MS
  return {
    id: null,
    title: '',
    body: '',
    publishAt: toKstInput(start),
    popup: false,
    popupUntil: toKstInput(start + 7 * DAY_MS),
    popupText: '',
  }
}

function draftFrom(notice: AdminNotice): NoticeDraft {
  const publishMs = parseServerTime(notice.publishAt)
  const untilMs = notice.popupUntil ? parseServerTime(notice.popupUntil) : NaN
  return {
    id: notice.id,
    title: notice.title,
    body: notice.body,
    publishAt: toKstInput(publishMs),
    popup: Number.isFinite(untilMs),
    popupUntil: toKstInput(Number.isFinite(untilMs) ? untilMs : publishMs + 7 * DAY_MS),
    popupText: notice.popupText ?? '',
  }
}

function buildInput(draft: NoticeDraft): { input: AdminNoticeInput } | { errors: string[] } {
  const errors: string[] = []
  const title = draft.title.trim()
  const body = draft.body.trim()
  if (!title) errors.push('제목을 입력해 주세요.')
  if (!body) errors.push('본문을 입력해 주세요.')
  for (const [value, max, label] of [
    [draft.title, 100, '제목'],
    [draft.body, 5000, '본문'],
    [draft.popupText, 300, '팝업 문구'],
  ] as const) {
    const error = tooLong(value, max, label)
    if (error) errors.push(error)
  }
  const publishMs = parseKstInput(draft.publishAt)
  if (publishMs === null) errors.push('게시 시각을 YYYY-MM-DD HH:mm 형식의 실제 시각으로 입력해 주세요(예: 2026-11-10 09:00).')
  let popupUntilMs: number | null = null
  const popupText = draft.popupText.trim()
  if (draft.popup) {
    popupUntilMs = parseKstInput(draft.popupUntil)
    if (popupUntilMs === null) errors.push('팝업 종료 시각을 YYYY-MM-DD HH:mm 형식의 실제 시각으로 입력해 주세요.')
    if (!popupText) errors.push('팝업 문구를 입력해 주세요(앱을 켤 때 카드에 보이는 짧은 요약).')
    if (publishMs !== null && popupUntilMs !== null) {
      if (popupUntilMs <= publishMs) errors.push('팝업 종료 시각은 게시 시각보다 뒤여야 해요.')
      else if (popupUntilMs > publishMs + MAX_POPUP_DAYS * DAY_MS) errors.push(`팝업은 게시 후 ${MAX_POPUP_DAYS}일까지만 띄울 수 있어요.`)
    }
  }
  if (errors.length || publishMs === null) return { errors }
  return {
    input: {
      title,
      body,
      publishAt: new Date(publishMs).toISOString(),
      popupUntil: draft.popup && popupUntilMs !== null ? new Date(popupUntilMs).toISOString() : undefined,
      popupText: draft.popup ? popupText : undefined,
    },
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405) && !error.serverMessage
}

function writeErrorMessage(error: unknown, fallback: string): string {
  if (isMissing(error)) return '서버에 앱 공지 기능이 아직 배포되지 않았습니다.'
  if (error instanceof ApiError && error.serverMessage) return error.serverMessage
  return getErrorMessage(error, fallback)
}

type NoticePhase = 'scheduled' | 'published'

const SECTIONS: { phase: NoticePhase; title: string; empty: string }[] = [
  { phase: 'scheduled', title: '예약', empty: '예약된 공지가 없습니다.' },
  { phase: 'published', title: '게시 중', empty: '여기서 쓴 공지가 아직 없습니다.' },
]

export default function NoticesScreen() {
  const [notices, setNotices] = useState<AdminNotice[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [draft, setDraft] = useState<NoticeDraft | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchAdminNotices(controller.signal)
      .then(setNotices)
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(isMissing(err) ? '서버에 앱 공지 기능이 아직 배포되지 않았습니다.' : getErrorMessage(err, '공지를 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey])

  // 예약 공지가 게시 시각을 지나도 다시 불러오기 전까지 서버 status 는 그대로라, 상태는 그릴 때 시각으로 가른다.
  const now = Date.now()
  const grouped = useMemo(() => {
    const groups: Record<NoticePhase, AdminNotice[]> = { scheduled: [], published: [] }
    for (const notice of notices ?? []) {
      groups[parseServerTime(notice.publishAt) > now ? 'scheduled' : 'published'].push(notice)
    }
    groups.scheduled.sort((a, b) => parseServerTime(a.publishAt) - parseServerTime(b.publishAt))
    groups.published.sort((a, b) => parseServerTime(b.publishAt) - parseServerTime(a.publishAt) || b.id - a.id)
    return groups
  }, [notices, now])

  const openNew = () => {
    setDraft(emptyDraft(Date.now()))
    setFormErrors([])
    setMessage(null)
  }
  const openEdit = (notice: AdminNotice) => {
    setDraft(draftFrom(notice))
    setFormErrors([])
    setMessage(null)
    setConfirmDelete(null)
  }
  const update = (patch: Partial<NoticeDraft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))

  const save = async () => {
    if (!draft || saving) return
    const result = buildInput(draft)
    if ('errors' in result) {
      setFormErrors(result.errors)
      return
    }
    setSaving(true)
    setFormErrors([])
    try {
      const saved = draft.id !== null ? await updateAdminNotice(draft.id, result.input) : await createAdminNotice(result.input)
      setNotices((prev) => {
        const list = prev ?? []
        return draft.id !== null ? list.map((item) => (item.id === draft.id ? saved : item)) : [saved, ...list]
      })
      const publishMs = parseServerTime(saved.publishAt)
      setMessage(
        publishMs > Date.now()
          ? `'${saved.title}' 공지를 예약했습니다. ${formatKst(publishMs)}부터 앱에 보입니다.`
          : `'${saved.title}' 공지를 게시했습니다. 앱을 새로 켜면 보입니다.`,
      )
      setDraft(null)
    } catch (err) {
      setFormErrors([writeErrorMessage(err, '저장하지 못했습니다.')])
    } finally {
      setSaving(false)
    }
  }

  const remove = async (notice: AdminNotice) => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteAdminNotice(notice.id)
      setNotices((prev) => (prev ? prev.filter((item) => item.id !== notice.id) : prev))
      setMessage(`'${notice.title}' 공지를 지웠습니다.`)
      setConfirmDelete(null)
      if (draft?.id === notice.id) setDraft(null)
    } catch (err) {
      setError(writeErrorMessage(err, '삭제하지 못했습니다.'))
    } finally {
      setDeleting(false)
    }
  }

  const renderItem = (notice: AdminNotice, phase: NoticePhase) => {
    const publishMs = parseServerTime(notice.publishAt)
    const untilMs = notice.popupUntil ? parseServerTime(notice.popupUntil) : NaN
    const popupLive = Number.isFinite(untilMs) && now < untilMs
    return (
      <Card key={notice.id}>
        <View style={styles.itemHeader}>
          {phase === 'scheduled' ? <Badge label="예약" tone="warning" /> : <Badge label="게시 중" tone="success" />}
          {popupLive ? <Badge label={phase === 'scheduled' ? '팝업 예약' : '팝업 중'} tone="info" /> : null}
          <Text style={[adminText.strong, styles.itemTitle]}>{notice.title}</Text>
        </View>
        <Text style={adminText.body}>
          {phase === 'scheduled' ? `${formatKst(publishMs)}부터 보임` : `${formatKst(publishMs)} 게시`}
          {Number.isFinite(untilMs) ? ` · 팝업 ${formatKst(untilMs)}까지` : ' · 팝업 없음'}
        </Text>
        {notice.popupText ? (
          <Text style={[adminText.muted, styles.meta]} numberOfLines={2}>
            팝업: {notice.popupText}
          </Text>
        ) : null}
        <Text style={[adminText.muted, styles.meta]} numberOfLines={3}>
          {notice.body}
        </Text>
        {confirmDelete === notice.id ? (
          <ConfirmBar
            message={`정말 삭제할까요? '${notice.title}' 공지가 앱 공지사항에서 바로 사라지고 되돌릴 수 없어요.`}
            confirmLabel="삭제"
            danger
            busy={deleting}
            onConfirm={() => void remove(notice)}
            onCancel={() => setConfirmDelete(null)}
          />
        ) : (
          <View style={styles.itemActions}>
            <Button label="수정" icon="create-outline" onPress={() => openEdit(notice)} small />
            <Button label="삭제" icon="trash-outline" variant="ghost" onPress={() => setConfirmDelete(notice.id)} small />
          </View>
        )}
      </Card>
    )
  }

  return (
    <View>
      <ScreenHeader
        title="앱 공지"
        subtitle="여기서 쓴 공지는 게시 시각부터 앱의 설정 > 공지사항에 보입니다. 팝업을 켜면 그 기간 동안 앱을 켤 때 한 번 뜹니다. 시각은 모두 한국 시간입니다. 앱은 켤 때 공지를 받아서, 게시 시각이 지난 뒤 앱을 새로 켜야 보입니다."
        right={draft ? null : <Button label="공지 쓰기" icon="add" variant="primary" onPress={openNew} small />}
      />

      {message ? <Text style={[adminText.muted, styles.message]}>{message}</Text> : null}

      {draft ? (
        <Card style={styles.formCard}>
          <Text style={adminText.strong}>{draft.id !== null ? `수정: ${draft.title || draft.id}` : '새 공지'}</Text>
          <Field label="제목 (필수)">
            <TextRow value={draft.title} onChangeText={(title) => update({ title })} maxLength={100} placeholder="예: 축제 기간 지도 안내" accessibilityLabel="제목" />
          </Field>
          <Field label="본문 (필수)" hint="설정 > 공지사항에서 눌렀을 때 보이는 글입니다. 줄바꿈이 그대로 보입니다.">
            <TextRow value={draft.body} onChangeText={(body) => update({ body })} maxLength={5000} multiline placeholder="공지 내용" accessibilityLabel="본문" />
          </Field>
          <Field label="게시 시각 (필수)" hint={`YYYY-MM-DD HH:mm, 한국 시간 · 지금 ${toKstInput(Date.now())}. 지금보다 앞이면 바로 게시됩니다.`}>
            <TextRow value={draft.publishAt} onChangeText={(publishAt) => update({ publishAt })} maxLength={16} placeholder="2026-11-10 09:00" keyboardType="numbers-and-punctuation" accessibilityLabel="게시 시각" />
          </Field>
          <Field label="앱을 켤 때 팝업">
            <OptionChips
              options={['팝업 없음', '팝업 띄우기']}
              isSelected={(label) => (label === '팝업 띄우기') === draft.popup}
              onToggle={(label) => {
                const popup = label === '팝업 띄우기'
                // 새로 켤 때는 종료 시각을 지금 적힌 게시 시각 + 7일로 맞춘다(게시 시각을 바꾼 뒤 켜도 앞뒤가 맞게).
                const publishMs = parseKstInput(draft.publishAt)
                update(popup && !draft.popup && publishMs !== null ? { popup, popupUntil: toKstInput(publishMs + 7 * DAY_MS) } : { popup })
              }}
              accessibilityLabel="팝업"
            />
          </Field>
          {draft.popup ? (
            <>
              <Field label="팝업 종료 시각 (필수)" hint={`이 시각 전까지 띄웁니다. 게시 후 ${MAX_POPUP_DAYS}일까지.`}>
                <TextRow value={draft.popupUntil} onChangeText={(popupUntil) => update({ popupUntil })} maxLength={16} placeholder="2026-11-17 09:00" keyboardType="numbers-and-punctuation" accessibilityLabel="팝업 종료 시각" />
              </Field>
              <Field label="팝업 문구 (필수)" hint="카드에 제목 아래로 보이는 짧은 요약입니다. 카드의 '공지 자세히 보기'를 누르면 본문이 열립니다.">
                <TextRow value={draft.popupText} onChangeText={(popupText) => update({ popupText })} maxLength={300} multiline placeholder="예: 축제 3일 동안 부스 위치를 지도에서 볼 수 있어요." accessibilityLabel="팝업 문구" />
              </Field>
            </>
          ) : null}
          {formErrors.length ? (
            <View style={formStyles.errors} accessibilityRole="alert">
              {formErrors.map((text) => (
                <Text key={text} style={formStyles.errorText}>
                  {text}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={formStyles.actions}>
            <Button label="취소" onPress={() => setDraft(null)} disabled={saving} small />
            <Button label={draft.id !== null ? '저장' : '등록'} variant="primary" onPress={save} loading={saving} small />
          </View>
        </Card>
      ) : null}

      {error ? <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} style={styles.error} /> : null}
      {!notices ? (
        loading ? <Loading /> : null
      ) : notices.length === 0 ? (
        <EmptyState message="여기서 쓴 공지가 아직 없습니다." />
      ) : (
        SECTIONS.map(({ phase, title, empty }) => (
          <View key={phase} style={styles.section}>
            <Text style={[adminText.strong, styles.sectionTitle]}>
              {title} <Text style={adminText.muted}>{grouped[phase].length}건</Text>
            </Text>
            {grouped[phase].length === 0 ? (
              <Text style={adminText.muted}>{empty}</Text>
            ) : (
              <View style={styles.list}>{grouped[phase].map((notice) => renderItem(notice, phase))}</View>
            )}
          </View>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  message: { marginBottom: 12 },
  formCard: { gap: 14, marginBottom: 16 },
  error: { marginBottom: 12 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, marginBottom: 8 },
  list: { gap: 12 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  itemTitle: { fontSize: 15 },
  meta: { marginTop: 4, fontSize: 12 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
})
