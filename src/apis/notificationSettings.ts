import { ApiError, apiRequest } from './client'

/**
 * 제보 알림 설정(`/users/me/notification-settings`, hongikon-be `NotificationSettingController`).
 * 게시판·분야·키워드와 별개인 알림 설정이다. 서버는 저장한 적 없으면 기본값을 준다.
 *
 * - `reportStatus`: 내가 올린 제보가 승인·반려되면 알림(`REPORT_STATUS` 푸시), 내 제보에 댓글이 달리면 알림(`REPORT_COMMENT`, 제보마다 10분에 한 번). 기본 켜짐
 * - `newReports`: 캠퍼스에 새 제보가 지도에 올라오면 알림(`REPORT_NEW` 푸시). 기본 꺼짐, 서버가 30분에 한 번으로 묶는다
 * - `newReportsScope`: 새 제보 알림 범위(기기 위치는 쓰지 않는다). 'CAMPUS' 는 캠퍼스 전체 새 제보(30분에 한 번 묶음),
 *   'KEYWORDS' 는 내 제보 키워드(`/users/me/report-keywords`)가 들어간 제보만 바로. 'KEYWORDS' 를 모르는 서버(배포 전)도 있다.
 * - `adminAlerts`: 관리자 알림(새 제보 승인 대기·새 문의·신고 자동 숨김, `ADMIN_*` 푸시). 기본 켜짐, 관리자에게만 의미가 있다.
 *   이 필드가 없는 서버(관리자 알림 배포 전)도 있어 선택 필드다.
 */
export type NewReportsScope = 'CAMPUS' | 'KEYWORDS'

export interface NotificationSettings {
  reportStatus: boolean
  newReports: boolean
  newReportsScope?: NewReportsScope
  adminAlerts?: boolean
}

export function getNotificationSettings(accessToken: string): Promise<NotificationSettings> {
  return apiRequest<NotificationSettings>('/users/me/notification-settings', { accessToken })
}

/** 보낸 필드만 바꾼다(부분 수정). 절댓값을 덮어쓰는 요청이라 여러 번 보내도 결과가 같아 재시도를 허락한다. */
export function patchNotificationSettings(
  changes: Partial<Pick<NotificationSettings, 'reportStatus' | 'newReports' | 'newReportsScope' | 'adminAlerts'>>,
  accessToken: string,
): Promise<NotificationSettings> {
  return apiRequest<NotificationSettings>('/users/me/notification-settings', {
    method: 'PATCH',
    body: changes,
    accessToken,
    retries: 2,
  })
}

/** 서버에 이 API 가 아직 없는지(배포 전). 계약상 이 경로는 404 를 주지 않는다. */
export function isNotificationSettingsApiMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
