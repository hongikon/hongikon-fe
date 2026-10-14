/**
 * 스토어의 홍익온 앱 주소. 웹판(hongikon.com)의 앱 설치 안내(`WebAppInstallBanner`)가 쓴다.
 *
 * App Store id 는 `eas.json` 의 `submit.production.ios.ascAppId` 와 같고, Safari 기본 배너용 메타 태그
 * (`scripts/fix-web-export.mjs` 의 apple-itunes-app)에도 같은 값이 들어간다.
 */
export const APP_STORE_ID = '6818954901'
export const APP_STORE_URL = `https://apps.apple.com/kr/app/id${APP_STORE_ID}`

/**
 * Google Play 주소. 아직 비공개 테스트라 일반 사용자는 열 수 없어 비워 둔다 — 이 값이 null 이면 Android 에는 안내를 띄우지 않는다.
 * 프로덕션 출시 뒤 `https://play.google.com/store/apps/details?id=com.hongikon.app` 로 바꾼다.
 */
export const PLAY_STORE_URL: string | null = null
