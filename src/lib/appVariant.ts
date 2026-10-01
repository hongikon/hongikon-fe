import Constants from 'expo-constants'

/**
 * 이 빌드가 운영(production) 빌드가 아닌지. `app.config.ts` 가 `extra.appVariant` 에 넣어 준다
 * (값이 없으면 운영으로 본다 — 개발용 화면이 실수로 일반 사용자에게 열리지 않게 하는 쪽이 안전하다).
 * 웹판(hongikon.com)은 netlify.toml 이 APP_VARIANT=production 으로 빌드한다.
 */
export const IS_NON_PRODUCTION_BUILD: boolean =
  String(Constants.expoConfig?.extra?.appVariant ?? 'production') !== 'production'

/** 개발자용 화면(앱 상태 확인, /temp/* 등)을 보여도 되는지. 로컬 개발 서버이거나 개발·테스트 빌드일 때만. */
export const SHOW_DEVELOPER_TOOLS: boolean = __DEV__ || IS_NON_PRODUCTION_BUILD
