import { Platform } from 'react-native'
import { APP_STORE_URL, PLAY_STORE_URL } from '../../constants/storeLinks'

export const DISMISS_KEY = '@hongikon_install_banner_dismissed_until'

/** Safari 가 아닌 iOS 브라우저(카카오톡·네이버·인스타그램 인앱, Chrome·Firefox 등). 이들은 Safari 기본 배너를 띄우지 않는다. */
export const NON_SAFARI_IOS = /CriOS|FxiOS|EdgiOS|OPiOS|KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|Whale/i

export type Store = { url: string; label: string }

/**
 * 어느 스토어로 안내할지. 안내하지 않으면 null.
 * - iPhone Safari: `apple-itunes-app` 메타 태그로 iOS 가 기본 배너를 띄우므로 여기서는 띄우지 않는다(두 개가 겹치지 않게).
 * - iPhone 의 다른 브라우저: 이 배너로 App Store 를 연다.
 * - Android: Play 가 공개된 뒤(`PLAY_STORE_URL`)부터.
 * - 데스크톱·관리자 화면(/admin): 띄우지 않는다.
 */
export function pickStore(): Store | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || typeof window === 'undefined') return null
  if (window.location.pathname.startsWith('/admin')) return null
  const ua = navigator.userAgent
  if (/iPhone|iPod/.test(ua)) {
    const safari = /Safari\//.test(ua) && !NON_SAFARI_IOS.test(ua)
    return safari ? null : { url: APP_STORE_URL, label: 'App Store' }
  }
  if (/Android/.test(ua) && PLAY_STORE_URL) return { url: PLAY_STORE_URL, label: 'Google Play' }
  return null
}

export function dismissedNow(): boolean {
  try {
    const until = Number(window.localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

/** 닫으면 이만큼 다시 띄우지 않는다. */
export const DISMISS_DAYS = 14
