import type { ReportDateRange } from '../api'
import { formatFloor } from '../../utils/common/floors'
import { parseServerDate } from '../format'
import type { AdminReport, ReportStatus, ReportStatusFilter, ReportTargetStatus } from '../types'

/**
 * 제보 검토 화면(ReportsScreen)의 순수 계산. 탭·기간 거르기, 상태별 처리 버튼, 확인 문구를 모은다.
 * react-native 를 import 하지 않아 `pnpm test` 에서 바로 돈다.
 */

export type ActionKind = 'approve' | 'reopen' | 'reject' | 'hide' | 'delete'

/**
 * 탭 값. 서버 상태 필터에 화면 전용 'UPCOMING'·'ENDED' 를 더한다 — 서버는 승인한 제보를 시작 전에도, 끝난 뒤에도 ACTIVE 로 두고
 * 지도 목록(live)에서만 빼기 때문에, ACTIVE 를 '노출 중'(지금 지도에 보임)·'예정'(시작 전)·'종료'(끝남)로 나눠 보여 준다.
 */
export type ScreenFilter = ReportStatusFilter | 'ENDED' | 'UPCOMING'

export const PERIOD_TABS = [
  { value: 'all' as const, label: '전체 기간' },
  { value: 'today' as const, label: '오늘' },
  { value: 'week' as const, label: '최근 7일' },
  { value: 'month' as const, label: '최근 30일' },
  { value: 'day' as const, label: '날짜 지정' },
]

/** 등록일 기간. 'day' 는 하루를 골라 ‹ › 로 앞뒤 날짜를 넘겨 본다. */
export type Period = 'all' | 'today' | 'week' | 'month' | 'day'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** ms → 한국 날짜 'yyyy-MM-dd'. */
export function kstDate(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 'yyyy-MM-dd' → '10.5 (일)' */
export function formatDayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${y}.${m}.${d} (${weekday})`
}

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + delta * DAY_MS).toISOString().slice(0, 10)
}

/** 기간 → 서버에 보낼 from·to(한국 날짜, 포함). 'all' 은 비운다. */
export function periodRange(period: Period, day: string, now: number = Date.now()): ReportDateRange {
  const today = kstDate(now)
  switch (period) {
    case 'today':
      return { from: today, to: today }
    case 'week':
      return { from: kstDate(now - 6 * DAY_MS), to: today }
    case 'month':
      return { from: kstDate(now - 29 * DAY_MS), to: today }
    case 'day':
      return { from: day, to: day }
    default:
      return {}
  }
}

/** 등록일이 기간 안인지(서버가 from·to 를 모를 때 화면에서 거르는 데 쓴다). */
export function inRange(report: AdminReport, range: ReportDateRange): boolean {
  if (!range.from && !range.to) return true
  const created = parseServerDate(report.createdAt)
  if (!created) return true
  const day = kstDate(created.getTime())
  return (!range.from || day >= range.from) && (!range.to || day <= range.to)
}

export function isEnded(report: AdminReport, now: number = Date.now()): boolean {
  const endsAt = parseServerDate(report.endsAt)
  return !!endsAt && endsAt.getTime() < now
}

/** 승인했지만 아직 시작 전(예정 제보). 시작 시각이 되면 지도에 뜬다. */
export function isUpcoming(report: AdminReport, now: number = Date.now()): boolean {
  const startsAt = parseServerDate(report.startsAt)
  return !!startsAt && startsAt.getTime() > now
}

/** 이 탭에 이 제보가 들어가는지(처리 직후 '방금 처리함' 표시에도 쓴다). */
export function belongsTo(report: AdminReport, filter: ScreenFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'ENDED') return report.status === 'ACTIVE' && isEnded(report)
  if (filter === 'UPCOMING') return report.status === 'ACTIVE' && isUpcoming(report)
  // '노출 중'은 지금 지도에 보이는 것 — 시작했고 아직 끝나지 않은 승인 제보(대시보드 숫자와 같은 기준).
  if (filter === 'ACTIVE') return report.status === 'ACTIVE' && !isEnded(report) && !isUpcoming(report)
  return report.status === filter
}

/** '노출 중'·'예정'·'종료'는 모두 서버의 ACTIVE 목록을 받아 시작·종료 시각으로 나눈다. */
export function splitsActive(filter: ScreenFilter): filter is 'ACTIVE' | 'ENDED' | 'UPCOMING' {
  return filter === 'ACTIVE' || filter === 'ENDED' || filter === 'UPCOMING'
}

/** 앱 관리 탭에서 처리 전에 묻는 문구. 반려는 사유를 적은 뒤에 묻는다. */
export const ACTION_CONFIRM: Record<ActionKind, { title: string; message: string; destructive?: boolean }> = {
  approve: { title: '제보를 승인할까요?', message: '승인하면 바로 지도와 목록에 보입니다.' },
  reopen: { title: '다시 공개할까요?', message: '숨겼던 제보가 다시 지도와 목록에 보입니다.' },
  reject: { title: '제보를 반려할까요?', message: '반려하면 지도와 목록에 보이지 않습니다.', destructive: true },
  hide: { title: '제보를 숨길까요?', message: '지도와 목록에서 내려갑니다. 나중에 다시 공개할 수 있습니다.', destructive: true },
  delete: { title: '제보를 삭제할까요?', message: '목록과 지도에서 사라지며 이 화면에서는 되돌릴 수 없습니다.', destructive: true },
}

export const ACTION_META: Record<ActionKind, { label: string; target: ReportTargetStatus }> = {
  approve: { label: '승인', target: 'ACTIVE' },
  reopen: { label: '다시 공개', target: 'ACTIVE' },
  reject: { label: '반려', target: 'REJECTED' },
  hide: { label: '숨김', target: 'HIDDEN' },
  delete: { label: '삭제', target: 'DELETED' },
}

/** 현재 상태에서 할 수 있는 처리. 이미 그 상태로 가는 버튼은 빼고, 삭제는 항상 끝에 둔다. */
export function actionsFor(status: ReportStatus): ActionKind[] {
  switch (status) {
    case 'PENDING':
      return ['approve', 'reject', 'hide', 'delete']
    case 'ACTIVE':
      return ['hide', 'reject', 'delete']
    case 'HIDDEN':
      return ['reopen', 'reject', 'delete']
    case 'REJECTED':
      // 반려하면 사진이 지워져 다시 공개할 수 없다(서버도 400, BE #28) — 지우기만 남긴다.
      return ['delete']
    default:
      return []
  }
}

export { withFocusedFirst } from './focus'

/** 처리 결과를 목록에 반영한다. 삭제는 빼고, 나머지는 그 자리에서 바꾼다(탭이 달라져도 '방금 처리함'으로 남긴다). */
export function applyReportUpdate(prev: AdminReport[] | null, updated: AdminReport): AdminReport[] | null {
  return prev
    ? updated.status === 'DELETED'
      ? prev.filter((item) => item.id !== updated.id)
      : prev.map((item) => (item.id === updated.id ? updated : item))
    : prev
}

/** 목록이 비었을 때 문구. */
export function emptyReportsMessage(period: Period, filter: ScreenFilter): string {
  return period !== 'all'
    ? '이 기간에 등록된 제보가 없습니다.'
    : filter === 'PENDING'
      ? '승인 대기 중인 제보가 없습니다.'
      : '해당하는 제보가 없습니다.'
}

/**
 * 카드에 보이는 장소. 캠퍼스 밖 제보는 건물·층이 없어 장소 설명에 '캠퍼스 밖'을 붙여 보여 준다(검토 때 위치를 바로 알게).
 */
export function reportLocationText(report: AdminReport): string {
  return (
    [report.buildingName, report.floor !== null ? `${report.floor}층` : null].filter(Boolean).join(' ') ||
    (report.placeLabel?.trim() ? `캠퍼스 밖 · ${report.placeLabel.trim()}` : '')
  )
}

/** 앱 지도 탭 미리보기 핀의 설명 줄: '작성자 이름 · 건물 층'(층 표기는 앱 지도와 같은 formatFloor). */
export function reportMapPreviewDetail(report: AdminReport): string {
  const place =
    [report.buildingName, report.floor !== null ? formatFloor(report.floor) : null].filter(Boolean).join(' ') ||
    report.placeLabel?.trim() ||
    ''
  return [report.authorDisplayName ? `작성자 ${report.authorDisplayName}` : null, place || null].filter(Boolean).join(' · ')
}

/** 웹 /admin: 좌표 검색이 정확한 구글 지도 주소(네이버 좌표 검색은 위치가 어긋났다). */
export function googleMapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
