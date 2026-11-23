import { Platform } from 'react-native'

/**
 * 마우스로 쓰는 데스크톱 웹인지(주 포인터가 정밀하고 hover 가 된다). 휴대폰·태블릿 브라우저는 손가락으로 칩 줄을 밀 수 있어 아니다.
 * 앱(iOS·Android)은 false.
 */
export function isDesktopPointer(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}
