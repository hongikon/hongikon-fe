/**
 * 스토어의 홍익온 앱 주소. 웹판(hongikon.com)의 앱 설치 안내(`WebAppInstallBanner`)가 쓴다.
 *
 * App Store id 는 `eas.json` 의 `submit.production.ios.ascAppId` 와 같고, Safari 기본 배너용 메타 태그
 * (`scripts/fix-web-export.mjs` 의 apple-itunes-app)에도 같은 값이 들어간다.
 */
export const APP_STORE_ID = '6818954901'
export const APP_STORE_URL = `https://apps.apple.com/kr/app/id${APP_STORE_ID}`

/**
 * Google Play 주소(2026-10-28 프로덕션 공개). Android 브라우저에서 웹판을 열면 이 주소로 안내한다.
 * null 로 두면 Android 에는 안내를 띄우지 않는다.
 */
export const PLAY_STORE_URL: string | null = 'https://play.google.com/store/apps/details?id=com.hongikon.app'
