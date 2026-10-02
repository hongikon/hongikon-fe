import type { MyReport, MyReportDisplayStatus } from '../apis/myReports'
import { COLORS } from '../constants/colors'
import { parseServerTime } from './serverTime'

/**
 * 화면용 상태. 서버가 준 `displayStatus` 를 따르고, 없으면(옛 서버·모르는 값) 저장 상태와 시각으로 정한다.
 * 승인 대기·승인된 제보는 기간이 지나면 ENDED, 승인됐지만 시작 전이면 SCHEDULED.
 */
export function resolveDisplayStatus(report: MyReport, now: number = Date.now()): MyReportDisplayStatus {
  if (report.displayStatus && report.displayStatus in STATUS_META) return report.displayStatus
  const { status } = report
  // 모르는 저장 상태(서버에 새로 생긴 값)는 STATUS_META 에 없어 카드가 그리다 죽는다 — 끝난 제보로 보여 준다.
  if (status !== 'PENDING' && status !== 'ACTIVE') return status in STATUS_META ? status : 'ENDED'
  const endsAt = parseServerTime(report.endsAt)
  if (!Number.isNaN(endsAt) && endsAt < now) return 'ENDED'
  const startsAt = parseServerTime(report.startsAt)
  if (status === 'ACTIVE' && !Number.isNaN(startsAt) && startsAt > now) return 'SCHEDULED'
  return status
}

export interface StatusMeta {
  label: string
  /** 상태 알약 아래 한 줄 안내(카드 안) */
  hint: string
  icon: 'time-outline' | 'calendar-outline' | 'map-outline' | 'checkmark-done-outline' | 'close-circle-outline' | 'eye-off-outline' | 'trash-outline'
  fg: string
  bg: string
}

export const STATUS_META: Record<MyReportDisplayStatus, StatusMeta> = {
  PENDING: {
    label: '승인 대기',
    hint: '운영진이 확인하고 있어요. 승인되면 알림으로 알려 드려요.',
    icon: 'time-outline',
    fg: COLORS.warning,
    bg: COLORS.warningSoft,
  },
  SCHEDULED: {
    // 지도 시트·관리 화면의 '예정'과 같은 말.
    label: '예정 · 승인됨',
    hint: '시작 시각이 되면 지도에 나타나요.',
    icon: 'calendar-outline',
    fg: COLORS.primary,
    bg: COLORS.primarySoft,
  },
  ACTIVE: {
    label: '지도에 표시 중',
    hint: '누르면 지도에서 볼 수 있어요.',
    icon: 'map-outline',
    fg: COLORS.success,
    bg: COLORS.successSoft,
  },
  ENDED: {
    label: '종료',
    hint: '기간이 끝나 지도에서 내려갔어요.',
    icon: 'checkmark-done-outline',
    fg: COLORS.textSecondary,
    bg: COLORS.fill,
  },
  REJECTED: {
    label: '반려',
    hint: '지도에 올라가지 않았어요.',
    icon: 'close-circle-outline',
    fg: COLORS.danger,
    bg: COLORS.dangerSoft,
  },
  HIDDEN: {
    label: '숨김',
    hint: '신고가 쌓이거나 운영진 판단으로 지도에서 숨겨졌어요.',
    icon: 'eye-off-outline',
    fg: COLORS.textSecondary,
    bg: COLORS.fill,
  },
  DELETED: {
    label: '삭제됨',
    hint: '운영진이 삭제한 제보예요.',
    icon: 'trash-outline',
    fg: COLORS.textTertiary,
    bg: COLORS.fill,
  },
}

/** 같은 id 가 두 페이지에 걸쳐 오면(사이에 새 제보가 생겨 밀림) 뒤의 것을 버린다. */
export function mergeReportPages(existing: readonly MyReport[], next: readonly MyReport[]): MyReport[] {
  const seen = new Set(existing.map((r) => r.id))
  return [...existing, ...next.filter((r) => !seen.has(r.id))]
}
