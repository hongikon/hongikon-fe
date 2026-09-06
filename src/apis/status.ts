import { apiRequest } from './client'

/** `GET /status` 응답. 백엔드 `StatusController` 참고. */
export interface BackendStatus {
  version: string
  buildTime: string
}

export async function getBackendStatus(): Promise<BackendStatus> {
  return apiRequest<BackendStatus>('/status')
}
