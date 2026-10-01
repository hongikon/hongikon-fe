import { apiRequest, type ApiRequestOptions } from './client'

/** 백엔드 `TokenType` (`UserDevice` 엔티티) 과 값이 일치해야 한다. */
export type PushTokenType = 'EXPO' | 'FCM' | 'APNS'
/** 백엔드 `DevicePlatform` 과 값이 일치해야 한다. */
export type DevicePlatform = 'IOS' | 'ANDROID' | 'WEB'

export interface DeviceResponse {
  id: number
  pushToken: string
  tokenType: PushTokenType
  platform: DevicePlatform
  isActive: boolean
}

/**
 * 푸시 알림 수신을 위해 기기를 등록한다(`POST /users/me/devices`).
 * 로그인 필요 — 게스트는 호출하지 않는다.
 */
export function registerDevice(
  pushToken: string,
  tokenType: PushTokenType,
  platform: DevicePlatform,
  accessToken: string,
): Promise<DeviceResponse> {
  return apiRequest<DeviceResponse>('/users/me/devices', {
    method: 'POST',
    body: { pushToken, tokenType, platform },
    accessToken,
  })
}

/**
 * 기기를 비활성화해 더 이상 푸시를 받지 않게 한다(`DELETE /users/me/devices/{id}`).
 * 로그아웃처럼 사용자를 기다리게 하면 안 되는 곳은 `options` 로 재시도·제한 시간을 줄인다.
 */
export function deactivateDevice(
  deviceId: number,
  accessToken: string,
  options: Pick<ApiRequestOptions, 'retries' | 'timeoutMs'> = {},
): Promise<void> {
  return apiRequest<void>(`/users/me/devices/${deviceId}`, {
    method: 'DELETE',
    accessToken,
    ...options,
  })
}
