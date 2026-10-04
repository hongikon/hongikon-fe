import { REPORT_CATEGORIES } from '../constants/reportCategories'
import type { ReportCategory } from '../types'
import type { FlagReason, ReportStatus } from './types'
import { parseServerTime } from '../utils/serverTime'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 서버 날짜 문자열 → Date. 존 없는 LocalDateTime 은 UTC 로 읽는다(`utils/serverTime.ts` 참고).
 * 브라우저 시간대와 상관없이 같은 시각으로 읽힌다.
 */
export function parseServerDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const ms = parseServerTime(value)
  return Number.isNaN(ms) ? null : new Date(ms)
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** `2026.09.30 14:05` (한국 시간). 해석 못 하면 '-'. */
export function formatDateTime(value: string | null | undefined): string {
  const date = parseServerDate(value)
  if (!date) return '-'
  const kst = new Date(date.getTime() + KST_OFFSET_MS)
  return (
    `${kst.getUTCFullYear()}.${pad(kst.getUTCMonth() + 1)}.${pad(kst.getUTCDate())} ` +
    `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`
  )
}

/** 같은 날이면 시각만, 다른 날이면 날짜까지. 기간(startsAt~endsAt) 표시에 쓴다. */
export function formatRange(start: string, end: string): string {
  const startText = formatDateTime(start)
  const endText = formatDateTime(end)
  if (startText.slice(0, 10) === endText.slice(0, 10)) {
    return `${startText} ~ ${endText.slice(11)}`
  }
  return `${startText} ~ ${endText}`
}

/** `방금 전` / `12분 전` / `3시간 후` 처럼 지금 기준 상대 시각. */
export function formatRelative(value: string | null | undefined, now: number = Date.now()): string {
  const date = parseServerDate(value)
  if (!date) return '-'
  const diffMs = date.getTime() - now
  const future = diffMs > 0
  const minutes = Math.floor(Math.abs(diffMs) / 60000)
  const suffix = future ? '후' : '전'
  if (minutes < 1) return future ? '곧' : '방금 전'
  if (minutes < 60) return `${minutes}분 ${suffix}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 ${suffix}`
  const days = Math.floor(hours / 24)
  return `${days}일 ${suffix}`
}

/** 두 시각 사이 걸린 시간. `1분 10초` */
export function formatDuration(start: string | null, end: string | null): string | null {
  const from = parseServerDate(start)
  const to = parseServerDate(end)
  if (!from || !to) return null
  const seconds = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000))
  if (seconds < 60) return `${seconds}초`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}분 ${rest}초` : `${minutes}분`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('ko-KR')
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: '승인 대기',
  ACTIVE: '노출 중',
  HIDDEN: '숨김',
  REJECTED: '반려',
  DELETED: '삭제됨',
}

export const FLAG_REASON_LABEL: Record<FlagReason, string> = {
  FALSE_INFO: '허위 정보',
  SPAM: '스팸·광고',
  INAPPROPRIATE: '욕설·혐오',
  PRIVACY: '개인정보 노출',
  ETC: '기타',
}

/**
 * 카테고리 이름. `reportCategoryMeta` 는 모르는 값에서 던지는데, 관리자 화면은 서버가
 * 새 카테고리를 먼저 내보내도 목록이 깨지지 않아야 해서 원문으로 대신한다.
 */
export function reportCategoryLabel(category: ReportCategory, customLabel: string | null): string {
  const meta = REPORT_CATEGORIES.find((item) => item.key === category)
  const label = meta?.label ?? category
  return category === 'ETC' && customLabel ? `${label} · ${customLabel}` : label
}

export function reportCategoryColor(category: ReportCategory): string {
  return REPORT_CATEGORIES.find((item) => item.key === category)?.color ?? '#64748B'
}

/**
 * 관리자 화면에서 회원을 가리키는 한 줄: "앱 표시 이름 · 회원 번호". 로그인(카카오/Apple) 닉네임 원문은 쓰지 않는다
 * (개인정보 보호법 제3조 최소 처리 — 원문은 회원 카드의 "로그인 닉네임 보기"로만).
 * - 표시 이름이 없으면(예전 서버가 원문만 보낸 경우 등) 이름 없이 회원 번호만.
 * - 회원 번호를 아직 안 보내는 서버면 #id, id 도 없으면 이름만(둘 다 없으면 fallback).
 */
export function formatMemberRef(
  displayName: string | null | undefined,
  memberCode: string | null | undefined,
  id: number | null | undefined,
  fallback = '알 수 없음',
): string {
  const code = memberCode ? memberCode : id !== null && id !== undefined ? `#${id}` : null
  const name = displayName?.trim() ? displayName.trim() : null
  if (name && code) return `${name} · ${code}`
  return name ?? code ?? fallback
}
