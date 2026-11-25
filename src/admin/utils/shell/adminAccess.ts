import type { OverviewState } from '../../types'

/**
 * 앱 안에서 "이 계정이 관리자인가"를 판단하고, 관리 탭이 쓸 대시보드 수치(overview)를 들고 있는다.
 *
 * 사용자 API 어디에도 역할(role)이 오지 않아, 로그인한 토큰으로 `GET /admin/overview` 를 보내 본다.
 * - 200 → 관리자(받은 수치는 탭 배지·대시보드에 그대로 쓴다)
 * - 403 → 관리자 아님
 * - 401 → 앱 재발급(AuthContext)이 처리한다. 재발급도 실패하면 거기서 로그아웃 → 여기 상태도 비운다.
 * - 네트워크 오류·404(관리자 API 없는 서버) 등 → 직전 판단을 유지한다(처음엔 "아님").
 *
 * 로그인 직후·토큰 복원 직후, 앱이 다시 앞으로 올 때(1분에 한 번까지), 관리 탭에 들어올 때마다 다시 묻는다.
 * 판단 결과와 수치는 메모리에만 둔다(기기에 저장하지 않는다) — 앱을 새로 켜면 항상 "아님"에서 시작해 다시 묻는다.
 * 권한 자체는 서버가 요청마다 확인하므로, 이 값은 탭을 보일지 정하는 데만 쓴다.
 */

/** 앱이 앞으로 올 때 다시 묻는 최소 간격 */
export const FOREGROUND_PROBE_INTERVAL_MS = 60_000

/** 관리자로 확인된 뒤 관리 탭이 하단 탭에 붙기를 기다리는 최대 시간(관리자 알림 탭 처리) */
export const ADMIN_TAB_WAIT_MS = 3_000

export interface AdminAccessValue {
  isAdmin: boolean
  overview: OverviewState
}
