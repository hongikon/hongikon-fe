import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { CHANGELOG } from '../../constants/changelog'

export type UpdatesModule = typeof import('expo-updates')

export let cachedUpdates: UpdatesModule | null | undefined

/** 웹·네이티브 모듈이 없는 환경에서도 죽지 않게, expo-updates 는 쓸 때 꺼내 본다. */
export function loadUpdates(): UpdatesModule | null {
  if (cachedUpdates !== undefined) return cachedUpdates
  cachedUpdates = null
  if (Platform.OS !== 'web') {
    try {
      cachedUpdates = require('expo-updates') as UpdatesModule
    } catch {
      cachedUpdates = null
    }
  }
  return cachedUpdates
}

export interface UpdateInfo {
  /** 스토어/테스트 빌드처럼 OTA 를 실제로 받는 환경인지(개발 서버·Expo Go·웹은 false) */
  enabled: boolean
  isEmbeddedLaunch: boolean
  createdAt: Date | null
  updateId: string | null
  channel: string | null
}

export function readUpdateInfo(): UpdateInfo | null {
  const Updates = loadUpdates()
  if (!Updates) return null
  try {
    return {
      enabled: Updates.isEnabled,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      createdAt: Updates.createdAt ?? null,
      updateId: Updates.updateId ?? null,
      channel: Updates.channel ?? null,
    }
  } catch {
    return null
  }
}

export function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '-'
}

/** "현재 버전 1.0.0 · 마지막 업데이트 2026-10-02" 의 뒷부분 */
export function describeInstalled(info: UpdateInfo | null): string {
  if (info?.enabled) {
    if (info.isEmbeddedLaunch) return '앱에 포함된 버전'
    if (info.createdAt) return `마지막 업데이트 ${formatDate(info.createdAt)}`
  }
  // 웹·개발 환경은 OTA 정보가 없어 변경 기록의 최신 날짜를 보여 준다.
  return CHANGELOG[0] ? `마지막 업데이트 ${CHANGELOG[0].date}` : ''
}
