import { Platform, StyleSheet } from 'react-native'

/**
 * 넓은 창(갤럭시 폴드 펼친 화면 · 태블릿 · 데스크톱 웹)에서 글·목록·폼이 화면 끝까지 늘어나지 않게
 * 가운데에 모으는 최대 너비. 폴드 안쪽 화면(약 884dp)에서도 양옆이 조금 비는 정도다.
 * 폰(≈360~430dp)·폴드 커버 화면(≈344dp)에서는 이보다 좁아 아무것도 바뀌지 않는다.
 */
export const CONTENT_MAX_WIDTH = 640

/** 지도 위에 뜨는 배너·하단 시트의 최대 너비. 지도 자체는 화면 끝까지 깐다. */
export const SHEET_MAX_WIDTH = 600

/** 가운데 뜨는 작은 안내 카드(확인 창 등)의 최대 너비. */
export const DIALOG_MAX_WIDTH = 420

export const layoutStyles = StyleSheet.create({
  /**
   * 스크롤 contentContainerStyle 이나 머리줄에 덧대 쓰는 "가운데 읽기 폭".
   * 좁은 화면에선 width 100% 라 기존과 같고, 넓은 화면에서만 CONTENT_MAX_WIDTH 로 멈춰 가운데 선다.
   */
  readable: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
})

/**
 * 목록을 아래로 끌면 키보드를 내린다(10-08 요청 — 검색창을 누르면 키보드가 아래에서 올라오니 내릴 때도 아래로 쓸어내린다).
 * iOS 는 손가락을 따라 키보드가 같이 내려가고(interactive), Android 는 끄는 순간 내려간다(on-drag 만 지원).
 */
export const KEYBOARD_DISMISS_MODE = Platform.OS === 'ios' ? ('interactive' as const) : ('on-drag' as const)
