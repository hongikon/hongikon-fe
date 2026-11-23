import { Linking } from 'react-native'

/**
 * 서버·크롤링 데이터에서 온 외부 링크를 연다. http(s) 만 허용한다 — 학교 게시판 HTML 에서 긁어 온 링크가
 * `javascript:`(웹판에서 hongikon.com 출처로 실행됨)나 `intent:`·다른 앱 스킴이면 열지 않는다.
 */
export function isSafeExternalUrl(url: string | null | undefined): url is string {
  if (!url) return false
  return /^https?:\/\/[^\s]+$/i.test(url.trim())
}

export function openExternalUrl(url: string | null | undefined, fallback?: string): void {
  const target = isSafeExternalUrl(url) ? url.trim() : isSafeExternalUrl(fallback) ? fallback : null
  if (!target) return
  Linking.openURL(target).catch(() => {})
}
