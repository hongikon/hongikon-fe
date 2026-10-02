import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'

/** 앱 밖 정적 페이지(hongikon.com/licenses/, /support/ 등)의 주소. 빌드 때 scripts/fix-web-export.mjs 가 만든다. */
export const SITE_ORIGIN = 'https://hongikon.com'

/**
 * hongikon.com 의 정적 페이지를 연다. 웹판은 같은 사이트라 그 주소로 이동하고(SPA 가 아닌 정적 HTML 이 뜬다),
 * 앱은 인앱 브라우저로 연다. `path` 는 '/licenses/' 처럼 슬래시로 시작한다.
 */
export function openSitePage(path: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.location.assign(path)
    return
  }
  WebBrowser.openBrowserAsync(SITE_ORIGIN + path).catch(() => {})
}
