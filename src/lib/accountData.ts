import AsyncStorage from '@react-native-async-storage/async-storage'
import { restoreSettings, toSignedOutSettings, type StoredSettings } from '../utils/settingsStorage'
import { clearTermsConsent } from './termsConsent'
import { deleteAccountHiddenAuthors } from './hiddenAuthors'

/** `SettingsContext` 의 저장 키. 로그아웃 정리가 같은 값을 고쳐 써야 해서 여기 둔다. */
export const SETTINGS_STORAGE_KEY = '@hongik_settings'

/**
 * 로그인 상태가 끝날 때(로그아웃·탈퇴·로그인 만료) 기기에서 지우는 것들을 한곳에 모은다.
 *
 * - `@hongik_settings` 의 구독·알림 값 → 게스트 기본값(`clearAccountLinkedSettings`). 북마크만 남긴다.
 * - 약관 동의 기록(`clearTermsConsent`) — 다음에 로그인하는 사람에게 다시 묻는다.
 * - 숨긴 사용자 목록·알림 스위치는 계정마다 따로 저장해 두고(`hiddenAuthors.ts`, 아래 `@hongikon_push_enabled:u:`)
 *   로그아웃해도 지우지 않는다 — 화면이 게스트 칸으로 바뀌어 다음 사람에게 보이지 않고, 같은 계정으로 다시 로그인하면
 *   그 값을 되살린다. 탈퇴면 그 계정 칸까지 지운다(`deleteWithdrawnAccountData`).
 */
export async function clearAccountLinkedDeviceData(): Promise<void> {
  await clearAccountLinkedSettings()
  await clearTermsConsent()
}

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

/**
 * '구독 소식 알림' 전체 스위치(`Settings.subscriptionAlert`)의 계정별 마지막 값. 스위치는 기기 단위(끄면 이 기기의 푸시
 * 등록을 내린다)라 서버에 따로 저장되지 않는다. 예전엔 로그아웃하면 게스트 기본값(켜짐)으로 돌아간 채 다시 로그인해,
 * 알림을 꺼 둔 사람도 기기가 다시 등록되고 푸시가 다시 왔다. 그래서 로그인한 계정마다 마지막 값을 따로 적어 두고
 * 로그인할 때 되살린다(`SettingsContext`). 이 기기에서 처음 보는 계정이면 켜짐.
 * 값: '1' 켜짐, '0' 꺼짐. 비밀 값이 아니라 AsyncStorage 에 둔다(웹은 localStorage).
 */
const PUSH_ENABLED_KEY_PREFIX = '@hongikon_push_enabled:u:'

/** 이 계정의 마지막 알림 스위치 값. 적어 둔 적이 없거나 읽지 못하면 null. */
export async function getAccountPushEnabled(userId: number): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_ENABLED_KEY_PREFIX + userId)
    return raw === '1' ? true : raw === '0' ? false : null
  } catch (error) {
    if (__DEV__) console.warn('계정의 알림 스위치 값을 읽지 못했습니다:', error)
    return null
  }
}

/** 이 계정의 알림 스위치 값을 적어 둔다. 실패해도 화면 값은 그대로 쓴다(다음 로그인 때 켜짐으로 시작할 뿐이다). */
export async function saveAccountPushEnabled(userId: number, enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_ENABLED_KEY_PREFIX + userId, enabled ? '1' : '0')
  } catch (error) {
    if (__DEV__) console.warn('계정의 알림 스위치 값을 저장하지 못했습니다:', error)
  }
}

/**
 * 탈퇴한 계정이 이 기기에 남긴 계정별 값(숨긴 사용자 목록, 알림 스위치)을 지운다. 회원 번호를 모르면(토큰 형식이 다름)
 * 계정별로 저장한 것도 없다. 실패해도 탈퇴는 막지 않는다.
 */
export async function deleteWithdrawnAccountData(userId: number | null): Promise<void> {
  await deleteAccountHiddenAuthors(userId)
  if (userId === null) return
  try {
    await AsyncStorage.removeItem(PUSH_ENABLED_KEY_PREFIX + userId)
  } catch (error) {
    if (__DEV__) console.warn('탈퇴한 계정의 알림 스위치 값을 지우지 못했습니다:', error)
  }
}
