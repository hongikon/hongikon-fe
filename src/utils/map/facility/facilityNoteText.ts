import { Platform } from 'react-native'

/**
 * 스터디룸·세미나실 예약은 신한은행 '헤이영 캠퍼스' 앱에서만 된다(웹 예약 주소 없음, 앱 안 공간예약 화면으로 바로 가는 공개 링크도 없다).
 * 그래서 문구의 '헤이영캠퍼스 공간예약' 을 눌러 앱 스토어의 헤이영 캠퍼스 페이지를 연다 — 설치돼 있으면 스토어에서 바로 '열기'.
 */
export const HEYYOUNG_IOS = "https://apps.apple.com/kr/app/id1605688685";

export const HEYYOUNG_ANDROID = "https://play.google.com/store/apps/details?id=com.shinhan.heyoung";

export function heyYoungUrl(): string {
  if (Platform.OS === "android") return HEYYOUNG_ANDROID;
  if (Platform.OS === "web" && typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)) {
    return HEYYOUNG_ANDROID;
  }
  return HEYYOUNG_IOS;
}
