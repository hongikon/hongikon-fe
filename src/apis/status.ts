import { apiRequest } from './client'

/** `GET /status` 응답. 백엔드 `StatusController` 참고. */
export interface BackendStatus {
  version: string
  buildTime: string
}

/** `signal` 은 화면을 떠날 때 요청을 끊는 용도(`useApiResource`). */
export async function getBackendStatus(options: { signal?: AbortSignal } = {}): Promise<BackendStatus> {
  return apiRequest<BackendStatus>('/status', { signal: options.signal })
}
