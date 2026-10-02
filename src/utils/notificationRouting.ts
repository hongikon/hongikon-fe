import type { PushNotificationData } from '../types'
import type { AdminIntent } from '../lib/adminIntents'

/**
 * 알림을 탭했을 때 갈 곳. 화면 이동 자체는 `lib/pushNotifications.ts` 가 한다 — 이 파일은 React·Expo 에
 * 기대지 않아 따로 검증할 수 있다.
 *
 * - `news`: 소식 상세(서버 id — 상세 화면이 `GET /news/{id}` 로 받아 그린다).
 * - `map`: 지도 탭. `focusReportId` 가 있으면 그 제보를 찾아 지도 가운데에 띄운다.
 * - `myReports`: 설정 탭의 내 제보 내역(반려 알림 — 반려된 제보는 지도에 없어 사유를 볼 곳이 내역뿐이다). `reportId` 를 맨 위에 강조한다.
 * - `admin`: 관리 탭의 해당 섹션(제보 승인 대기·숨김, 문의). 관리자가 아니면 지도로 돌린다(`AdminAccessProvider`).
 * - `none`: 형식이 이상한 payload — 조용히 무시한다.
 */
export type NotificationTarget =
  | { kind: 'news'; newsId: string }
  | { kind: 'map'; focusReportId: number | null }
  | { kind: 'myReports'; reportId: number | null }
  | { kind: 'admin'; intent: AdminIntent }
  | { kind: 'none' }

const ADMIN_TYPES: ReadonlySet<string> = new Set([
  'ADMIN_REPORT_PENDING',
  'ADMIN_REPORT_REMINDER',
  'ADMIN_REPORT_FLAGGED',
  'ADMIN_FEEDBACK',
])

/** 관리자 알림(`AdminAlertDispatcher`, 승인 대기 리마인드 `AdminReportReminder`)인지 — 앱이 켜져 있을 때 표시·배지 갱신에 쓴다. */
export function isAdminNotification(data: unknown): boolean {
  return !!data && typeof data === 'object' && ADMIN_TYPES.has(String((data as { type?: unknown }).type))
}

function toReportId(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.trim()) : value
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
}

export function notificationTarget(data: Partial<PushNotificationData> | null | undefined): NotificationTarget {
  if (!data || typeof data !== 'object') return { kind: 'none' }

  switch (data.type) {
    case 'NEWS': {
      // 목록(`GET /news`)이 페이지 단위라 id로 항목을 찾을 수 없다 — id만 넘기면 상세 화면이
      // `GET /news/{id}`로 받아 그린다. 백엔드(NewsPushDispatcher)는 newsId 를 숫자로 보낸다.
      const newsId = String((data as { newsId?: unknown }).newsId ?? '').trim()
      // 서버 id 가 아니면(옛 로컬 스냅샷 id 등) 찾을 방법이 없으니 무시한다.
      return /^\d+$/.test(newsId) ? { kind: 'news', newsId } : { kind: 'none' }
    }
    case 'REPORT_STATUS': {
      // 승인: 지도에서 그 제보를 띄운다. 반려: 지도에 없으니 내 제보 내역에서 사유와 함께 보여 준다.
      // 그 밖의 상태(앞으로 생길 값)는 지도만 연다.
      const { status, reportId } = data as { status?: unknown; reportId?: unknown }
      if (status === 'REJECTED') return { kind: 'myReports', reportId: toReportId(reportId) }
      return { kind: 'map', focusReportId: status === 'ACTIVE' ? toReportId(reportId) : null }
    }
    case 'REPORT_NEW':
    // 내 제보에 댓글이 달림 — 지도에서 그 제보 시트(댓글 미리보기 포함)를 연다.
    case 'REPORT_COMMENT':
    // 내 제보 🔥 기념(10·50·100), 관심 제보의 시작·곧 끝남·새 댓글 — 모두 그 제보 시트를 연다.
    case 'REPORT_FIRE':
    case 'REPORT_FOLLOW':
      return { kind: 'map', focusReportId: toReportId((data as { reportId?: unknown }).reportId) }
    // 관리자 알림. 묶음 알림("새 제보 3건")이면 id 는 마지막 건이다 — 그 건을 맨 위에 강조하고 나머지는 목록에 있다.
    case 'ADMIN_REPORT_PENDING':
      return {
        kind: 'admin',
        intent: { section: 'reports', reportFilter: 'PENDING', reportId: toReportId((data as { reportId?: unknown }).reportId) },
      }
    // 승인 대기 리마인드("검토 대기 중인 제보가 N건") — 승인 대기 목록을 열고 가장 오래된 제보를 강조한다.
    case 'ADMIN_REPORT_REMINDER':
      return {
        kind: 'admin',
        intent: {
          section: 'reports',
          reportFilter: 'PENDING',
          reportId: toReportId((data as { oldestReportId?: unknown }).oldestReportId),
        },
      }
    case 'ADMIN_REPORT_FLAGGED':
      return {
        kind: 'admin',
        intent: { section: 'reports', reportFilter: 'HIDDEN', reportId: toReportId((data as { reportId?: unknown }).reportId) },
      }
    case 'ADMIN_FEEDBACK':
      return {
        kind: 'admin',
        intent: { section: 'feedback', feedbackId: toReportId((data as { feedbackId?: unknown }).feedbackId) },
      }
    default:
      // 모르는 type(앞으로 생길 알림)은 앱을 기본 화면으로만 연다.
      return { kind: 'map', focusReportId: null }
  }
}
