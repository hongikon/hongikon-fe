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

/**
 * 글자 단계. 화면마다 12.5·13.5 같은 값을 따로 만들지 말고 여기서 고른다.
 * 색은 넣지 않는다(쓰는 자리에서 COLORS 로 고른다). 굵기는 위 FONTS 로만 정한다.
 */
export const TYPE = {
  /** 탭 화면 맨 위 큰 제목(소식·설정) */
  screenTitle: { fontFamily: FONTS.bold, fontSize: 22, lineHeight: 30 },
  /** 상세 글 제목 */
  title: { fontFamily: FONTS.bold, fontSize: 20, lineHeight: 28 },
  /** 머리줄 가운데 제목·완료 화면 제목 */
  headline: { fontFamily: FONTS.semibold, fontSize: 17, lineHeight: 24 },
  /** 카드·줄 안의 굵은 제목 */
  subhead: { fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 21 },
  /** 긴 본문(소식 본문) */
  bodyLarge: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 24 },
  /** 목록 줄·입력칸 등 기본 글자 */
  body: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 21 },
  /** 설명·안내 문구 */
  callout: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19 },
  /** 섹션 제목(설정의 '계정'·'알림' 같은 묶음 이름) */
  section: { fontFamily: FONTS.semibold, fontSize: 13, lineHeight: 18 },
  /** 날짜·개수·보조 정보 */
  caption: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17 },
  /** 칩·배지 글자 */
  label: { fontFamily: FONTS.semibold, fontSize: 12, lineHeight: 16 },
} as const
