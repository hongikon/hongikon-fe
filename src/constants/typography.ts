/**
 * Pretendard 는 굵기마다 별도 파일을 별도 패밀리로 등록한다.
 *
 * React Native 에서 커스텀 폰트는 fontWeight 로 굵기를 고를 수 없다.
 * fontWeight 를 주면 iOS 는 원본을 눌러 만든 가짜 굵게를 그리고 Android 는 무시한다.
 * 그래서 이 앱에서 굵기는 fontWeight 가 아니라 fontFamily 로 지정한다.
 *
 * 새 텍스트 스타일을 만들 때도 fontWeight 대신 아래 값을 쓴다.
 */
export const FONTS = {
  /** 400. 본문 기본값 */
  regular: 'Pretendard-Regular',
  /** 500 */
  medium: 'Pretendard-Medium',
  /** 600 */
  semibold: 'Pretendard-SemiBold',
  /** 700 */
  bold: 'Pretendard-Bold',
} as const

/**
 * useFonts 에 넘길 자산 맵. 여기 쓰인 키가 그대로 fontFamily 이름이 된다.
 * 코드베이스가 쓰는 네 굵기만 넣는다. 나머지 다섯 굵기는 번들만 키운다.
 */
export const FONT_ASSETS = {
  [FONTS.regular]: require('../../assets/fonts/Pretendard-Regular.otf'),
  [FONTS.medium]: require('../../assets/fonts/Pretendard-Medium.otf'),
  [FONTS.semibold]: require('../../assets/fonts/Pretendard-SemiBold.otf'),
  [FONTS.bold]: require('../../assets/fonts/Pretendard-Bold.otf'),
}
