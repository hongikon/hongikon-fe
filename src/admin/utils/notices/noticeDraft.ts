import type { AdminNotice, AdminNoticeInput } from '../../types'
import { parseServerTime } from '../../../utils/common/serverTime'
import { tooLong, type BuildResult } from '../facilities/mapFormRules'

/**
 * 앱 공지 관리(NoticesScreen)의 한국 시각 입력 변환, 편집 초안 ↔ 서버 본문, 예약·게시 중 묶기. 순수 함수라 `pnpm test` 에서 바로 돈다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
export const DAY_MS = 24 * 60 * MINUTE_MS
/** 서버 규칙(AppNoticeService)과 같다. */
export const MAX_POPUP_DAYS = 31
const KST_TIME_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/

/** epoch ms → 'YYYY-MM-DD HH:mm'(KST) */
export function toKstInput(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ')
}

/** 'YYYY-MM-DD HH:mm'(KST) → epoch ms, 실제 날짜·시각이 아니면 null. */
export function parseKstInput(value: string): number | null {
  const text = value.trim()
  const match = KST_TIME_RE.exec(text)
  if (!match) return null
  const ms = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00+09:00`)
  if (!Number.isFinite(ms) || toKstInput(ms) !== text) return null
  return ms
}

/** '11/10(화) 09:00' — 목록에 보이는 한국 시각. */
export function formatKst(ms: number): string {
  const d = new Date(ms + KST_OFFSET_MS)
  const day = '일월화수목금토'[d.getUTCDay()]
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${day}) ${hh}:${mm}`
}

export interface NoticeDraft {
  id: number | null
  title: string
  body: string
  publishAt: string
  popup: boolean
  popupUntil: string
  popupText: string
}

export function emptyNoticeDraft(now: number): NoticeDraft {
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

export function noticeDraftFrom(notice: AdminNotice): NoticeDraft {
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

/** 화면 검증. 통과하면 요청 본문, 아니면 오류 문구 목록. */
export function buildNoticeInput(draft: NoticeDraft): BuildResult<AdminNoticeInput> {
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

export type NoticePhase = 'scheduled' | 'published'

export const NOTICE_SECTIONS: { phase: NoticePhase; title: string; empty: string }[] = [
  { phase: 'scheduled', title: '예약', empty: '예약된 공지가 없습니다.' },
  { phase: 'published', title: '게시 중', empty: '여기서 쓴 공지가 아직 없습니다.' },
]

/**
 * 예약(게시 시각이 아직 안 됨, 빠른 순)·게시 중(최근 순, 같으면 id 큰 순)으로 묶는다.
 * 예약 공지가 게시 시각을 지나도 다시 불러오기 전까지 서버 status 는 그대로라, 상태는 그릴 때 시각으로 가른다.
 */
export function groupNotices(notices: readonly AdminNotice[], now: number): Record<NoticePhase, AdminNotice[]> {
  const groups: Record<NoticePhase, AdminNotice[]> = { scheduled: [], published: [] }
  for (const notice of notices) {
    groups[parseServerTime(notice.publishAt) > now ? 'scheduled' : 'published'].push(notice)
  }
  groups.scheduled.sort((a, b) => parseServerTime(a.publishAt) - parseServerTime(b.publishAt))
  groups.published.sort((a, b) => parseServerTime(b.publishAt) - parseServerTime(a.publishAt) || b.id - a.id)
  return groups
}

/** 팝업 칩을 바꿀 때의 초안 변경. 새로 켤 때는 종료 시각을 지금 적힌 게시 시각 + 7일로 맞춘다(게시 시각을 바꾼 뒤 켜도 앞뒤가 맞게). */
export function popupTogglePatch(draft: NoticeDraft, popup: boolean): Partial<NoticeDraft> {
  const publishMs = parseKstInput(draft.publishAt)
  return popup && !draft.popup && publishMs !== null ? { popup, popupUntil: toKstInput(publishMs + 7 * DAY_MS) } : { popup }
}

/** 저장 뒤 안내: 게시 시각이 앞이면 예약, 아니면 바로 게시. */
export function noticeSavedMessage(saved: AdminNotice, now: number): string {
  const publishMs = parseServerTime(saved.publishAt)
  return publishMs > now
    ? `'${saved.title}' 공지를 예약했습니다. ${formatKst(publishMs)}부터 앱에 보입니다.`
    : `'${saved.title}' 공지를 게시했습니다. 앱을 새로 켜면 보입니다.`
}
