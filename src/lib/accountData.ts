import AsyncStorage from '@react-native-async-storage/async-storage'
import { restoreSettings, toSignedOutSettings, type StoredSettings } from '../utils/settingsStorage'

/** `SettingsContext` 의 저장 키. 로그아웃 정리가 같은 값을 고쳐 써야 해서 여기 둔다. */
export const SETTINGS_STORAGE_KEY = '@hongik_settings'

/**
 * 기기에 저장된 계정 연동 설정(`@hongik_settings` 의 구독·알림 값)을 지운다. 북마크만 남긴다(`toSignedOutSettings`).
 *
 * `AuthContext` 가 로그아웃·탈퇴·로그인 만료 때 토큰을 지우기 **전에** 부른다 — 중간에 앱이 꺼져도
 * "토큰은 없는데 이전 계정 설정이 남은" 상태가 생기지 않게. 거꾸로 토큰만 남으면 다음 실행 때 로그인 상태로
 * 서버 값을 다시 받아 오므로 잃는 것이 없다.
 *
 * 화면에 떠 있는 값(메모리)과 서버 전송 대기열은 `SettingsContext` 가 로그인 → 비로그인 전환을 보고 비운다.
 * 실패해도 로그아웃은 막지 않는다(그 경우에도 메모리 쪽 정리가 곧 같은 값으로 다시 저장한다).
 */
export async function clearAccountLinkedSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return
    const { settings } = restoreSettings(JSON.parse(raw) as StoredSettings)
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(toSignedOutSettings(settings)))
  } catch (error) {
    if (__DEV__) console.warn('로그아웃 중 기기에 저장된 계정 설정을 지우지 못했습니다:', error)
  }
}
