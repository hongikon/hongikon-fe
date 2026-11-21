/**
 * 제보 알림 설정(내 제보 결과·캠퍼스 새 제보) 로컬 ↔ 서버 맞추기 규칙. React 에 기대지 않아 따로 검증할 수 있다.
 * 상태와 요청은 `SettingsContext` 가 맡는다.
 *
 * 로컬 값에는 "서버에 아직 못 올린 변경이 있는지"(`dirty`)를 함께 저장한다.
 * - 게스트로 바꾼 값, 서버에 API 가 없어(404) 기기에만 둔 값, 연결 문제로 못 보낸 값 → dirty
 * - 로그인해서 서버 값을 받았을 때 dirty 면 로컬 값이 이기고 서버로 올린다(게시판 구독처럼 게스트 설정이 로그인 후 그대로 적용).
 *   dirty 가 아니면 서버 값이 진실이다(다른 기기에서 바꾼 값을 따른다).
 */
export interface ReportAlertPrefs {
  reportStatus: boolean
  newReports: boolean
}

export const DEFAULT_REPORT_ALERT_PREFS: ReportAlertPrefs = {
  reportStatus: true,
  newReports: false,
}

export function sameReportAlertPrefs(a: ReportAlertPrefs, b: ReportAlertPrefs): boolean {
  return a.reportStatus === b.reportStatus && a.newReports === b.newReports
}

/**
 * 로그인 직후(또는 재연결 후) 서버 값을 받았을 때 화면에 쓸 값과 서버로 보낼 값.
 * `toPatch` 가 null 이면 보낼 게 없다(서버와 같음).
 */
export function resolveReportAlertPrefs(
  local: ReportAlertPrefs,
  server: ReportAlertPrefs,
  localDirty: boolean,
): { next: ReportAlertPrefs; toPatch: ReportAlertPrefs | null } {
  if (!localDirty) return { next: { reportStatus: server.reportStatus, newReports: server.newReports }, toPatch: null }
  return { next: local, toPatch: sameReportAlertPrefs(local, server) ? null : local }
}
