import type { ComponentType } from 'react'
import { Platform, type StyleProp, type ViewStyle } from 'react-native'
import { requireOptionalNativeModule } from 'expo'
import { buildAppleLoginRequest, createAppleNonce, type AppleLoginRequestBody } from './appleNonce'

/**
 * Sign in with Apple (iOS 전용).
 *
 * 왜 `expo-apple-authentication` 을 바로 import 하지 않나 (src/lib/haptics.ts 와 같은 이유):
 * 이미 깔린 앱은 OTA(runtimeVersion = appVersion, 같은 1.0.0)로 새 JS 만 받는다. 그 바이너리에는
 * ExpoAppleAuthentication 네이티브 모듈이 없다. 패키지 index 는 불러오는 순간 버튼용
 * `requireNativeViewManager('ExpoAppleAuthentication')` 를 실행하므로, 맨 위에서 import 하면 구버전
 * 바이너리에서 앱 시작 시점에 경고·오류가 날 수 있다.
 * 그래서 iOS 이고 `requireOptionalNativeModule`(없으면 throw 대신 null)로 네이티브 모듈이 있을 때만
 * 패키지를 `require` 한다(Metro 는 require 를 처음 부를 때 모듈을 평가한다). 웹·안드로이드·구버전 바이너리는
 * 버튼 자체가 안 보인다.
 */

/** 패키지에서 쓰는 것만. 값은 expo-apple-authentication 의 enum 숫자와 같다. */
interface AppleAuthenticationPackage {
  isAvailableAsync: () => Promise<boolean>
  signInAsync: (options: { requestedScopes?: number[]; nonce?: string }) => Promise<{
    identityToken: string | null
    authorizationCode: string | null
    fullName: { givenName: string | null; familyName: string | null } | null
  }>
  AppleAuthenticationScope: { FULL_NAME: number; EMAIL: number }
  AppleAuthenticationButtonType: { SIGN_IN: number; CONTINUE: number; SIGN_UP: number }
  AppleAuthenticationButtonStyle: { WHITE: number; WHITE_OUTLINE: number; BLACK: number }
  AppleAuthenticationButton: ComponentType<{
    buttonType: number
    buttonStyle: number
    cornerRadius?: number
    onPress: () => void
    style?: StyleProp<ViewStyle>
  }>
}

// undefined = 아직 찾아보지 않음, null = 없음(웹·안드로이드·구버전 바이너리).
let cached: AppleAuthenticationPackage | null | undefined

function getPackage(): AppleAuthenticationPackage | null {
  if (cached !== undefined) return cached
  cached = null
  if (Platform.OS !== 'ios') return cached
  try {
    if (requireOptionalNativeModule('ExpoAppleAuthentication')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-apple-authentication') as AppleAuthenticationPackage
    }
  } catch {
    cached = null
  }
  return cached
}

/** 이 기기에서 Apple 로그인 버튼을 보여도 되는지. iOS + 네이티브 모듈 있음 + 기기 지원(iOS 13+)일 때만 true. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  const pkg = getPackage()
  if (!pkg) return false
  try {
    return await pkg.isAvailableAsync()
  } catch {
    return false
  }
}

/** Apple 공식 버튼 컴포넌트와 상수. 모듈이 없으면 null (그땐 버튼을 그리지 않는다). */
export function getAppleButton(): Pick<
  AppleAuthenticationPackage,
  'AppleAuthenticationButton' | 'AppleAuthenticationButtonType' | 'AppleAuthenticationButtonStyle'
> | null {
  return getPackage()
}

/** 사용자가 Apple 시트를 닫아 취소했는지(조용히 넘어갈 오류). */
export function isAppleSignInCanceled(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED'
  )
}

/**
 * Apple 로그인 시트를 띄우고 서버(`POST /auth/apple`)에 보낼 본문을 만든다.
 * 이름만 요청한다(이메일은 서비스에 쓰지 않아 요청하지 않음 — 최소 수집).
 * 취소하면 ERR_REQUEST_CANCELED 코드를 가진 오류를 그대로 던진다({@link isAppleSignInCanceled}).
 */
export async function requestAppleSignIn(): Promise<AppleLoginRequestBody> {
  const pkg = getPackage()
  if (!pkg) throw new Error('이 기기에서는 Apple 로그인을 사용할 수 없습니다.')
  const nonce = createAppleNonce()
  const credential = await pkg.signInAsync({
    requestedScopes: [pkg.AppleAuthenticationScope.FULL_NAME],
    nonce: nonce.hashed,
  })
  return buildAppleLoginRequest(credential, nonce.raw)
}
