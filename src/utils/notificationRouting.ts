import type { PushNotificationData } from '../types'

/**
 * 알림을 탭했을 때 갈 곳. 화면 이동 자체는 `lib/pushNotifications.ts` 가 한다 — 이 파일은 React·Expo 에
 * 기대지 않아 따로 검증할 수 있다.
 *
 * - `news`: 소식 상세(서버 id). `localNews`: 로컬 표본 소식 id(AppStatusScreen 테스트 알림).
 * - `map`: 지도 탭. `focusReportId` 가 있으면 그 제보를 찾아 지도 가운데에 띄운다.
 * - `none`: 형식이 이상한 payload — 조용히 무시한다.
 */
export type NotificationTarget =
  | { kind: 'news'; newsId: string }
  | { kind: 'localNews'; newsId: string }
  | { kind: 'map'; focusReportId: number | null }
  | { kind: 'none' }

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
      if (/^\d+$/.test(newsId)) return { kind: 'news', newsId }
      // 로컬 표본 알림은 크롤링 스냅샷 id(예: 'univ-154856')를 쓴다.
      return newsId ? { kind: 'localNews', newsId } : { kind: 'none' }
    }
    case 'REPORT_STATUS': {
      // 반려된 제보는 지도에 없으니 지도만 연다.
      const { status, reportId } = data as { status?: unknown; reportId?: unknown }
      return { kind: 'map', focusReportId: status === 'ACTIVE' ? toReportId(reportId) : null }
    }
    case 'REPORT_NEW':
      return { kind: 'map', focusReportId: toReportId((data as { reportId?: unknown }).reportId) }
    default:
      // 모르는 type(앞으로 생길 알림)은 앱을 기본 화면으로만 연다.
      return { kind: 'map', focusReportId: null }
  }
}
