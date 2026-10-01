/**
 * 카카오 로그인 1회용 code 를 이 앱 인스턴스에 묶는 PKCE(RFC 7636, S256). 순수 함수만 둔다.
 *
 * 왜: 로그인이 끝나면 서버가 `hongikon://auth/callback?code=...` 로 돌려보내는데, 안드로이드에서는 같은 스킴을
 * 등록한 다른 앱이 이 딥링크(=code)를 가로챌 수 있다. 로그인 시작 때 code_challenge(=base64url(sha256(verifier)))
 * 만 서버에 주고, 교환(`POST /auth/token/exchange`) 때 원본 verifier 를 같이 보내면 가로챈 code 만으로는
 * 토큰을 받을 수 없다. 서버 쪽은 hongikon-be `auth/exchange/Pkce.java`.
 *
 * 난수·SHA-256 은 Apple nonce 와 같은 구현을 쓴다(expo-crypto 없이 기존 바이너리에서도 OTA 로 동작).
 */
import { defaultRandomHex, sha256Hex, type RandomHexSource } from './appleNonce'

export interface PkcePair {
  /** 교환 때 서버로 보낼 원본(16진수 64자 — RFC 7636 의 43~128자, unreserved 문자) */
  verifier: string
  /** 로그인 시작 주소에 붙일 base64url(sha256(verifier)), 패딩 없음 43자 */
  challenge: string
}

export function createPkcePair(randomHex: RandomHexSource = defaultRandomHex): PkcePair {
  const verifier = randomHex().slice(0, 128)
  if (!/^[0-9a-f]{43,128}$/i.test(verifier)) throw new Error('PKCE verifier 난수 형식이 올바르지 않습니다.')
  return { verifier, challenge: hexToBase64Url(sha256Hex(verifier)) }
}

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** 16진수 → base64url(패딩 없음). btoa 가 없는 런타임(Hermes 구버전)도 있어 직접 계산한다. */
export function hexToBase64Url(hex: string): string {
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16))
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += BASE64URL[(n >> 18) & 63] + BASE64URL[(n >> 12) & 63]
    if (i + 1 < bytes.length) out += BASE64URL[(n >> 6) & 63]
    if (i + 2 < bytes.length) out += BASE64URL[n & 63]
  }
  return out
}
