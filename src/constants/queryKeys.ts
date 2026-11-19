/**
 * 조회 키(`useQuery`·`useApiResource({ queryKey })`). 저장(`useMutation` 의 `invalidates`)이 이 키를 무효화하면
 * 같은 데이터를 보여 주는 화면이 다시 받는다. 앞부분이 같으면 같이 깨어난다(`'reports'` → `'reports:map'`).
 */
export const QUERY_KEYS = {
  /** 지도 제보 레이어(진행 중·예정 또는 HOT). */
  mapReports: 'reports:map',
  /** 제보 전체 — 내 제보를 지우거나 고치면 무효화한다. */
  reports: 'reports',
} as const
