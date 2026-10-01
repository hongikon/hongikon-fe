/**
 * Sign in with Apple 의 nonce 와 서버 요청 본문을 만드는 순수 함수들(React Native 의존 없음 — tsx 로 바로 테스트한다).
 *
 * nonce 흐름(Firebase 등과 같은 표준 방식):
 * - 앱이 무작위 원본(raw) nonce 를 만든다.
 * - Apple 에는 `sha256(raw)` 를 넘긴다. Apple 은 받은 값을 **그대로** identity token 의 `nonce` 클레임에 넣는다.
 * - 서버(`POST /auth/apple`)에는 원본을 보낸다. 서버가 sha256 해서 토큰 값과 맞춰 본다.
 *
 * 왜 expo-crypto 를 안 쓰나: 새 네이티브 모듈이라, 이미 깔린 1.0.0 바이너리(OTA 로 JS 만 받음)에는 없다.
 * Hermes 에는 `crypto.getRandomValues`/`crypto.subtle` 도 없다. 그래서 난수는 모든 Expo 바이너리에 들어 있는
 * expo-modules-core 의 네이티브 UUID v4(iOS Foundation `UUID()` — 시스템 보안 난수)를 쓰고, SHA-256 은 여기서 직접 계산한다.
 */

/** UTF-8 문자열의 SHA-256 을 소문자 16진수로. (FIPS 180-4) */
export function sha256Hex(message: string): string {
  const bytes = utf8Bytes(message)
  const bitLength = bytes.length * 8
  // 패딩: 0x80, 0 들, 마지막 8바이트에 비트 길이(빅엔디언). 전체 길이는 64의 배수.
  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6)
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(paddedLength - 4, bitLength >>> 0)

  const h = H0.slice()
  const w = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }
  return h.map((word) => word.toString(16).padStart(8, '0')).join('')
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n))
}

function utf8Bytes(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text)
  // TextEncoder 가 없는 런타임 대비(Expo 런타임엔 있다).
  const out: number[] = []
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number
    if (cp < 0x80) out.push(cp)
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
  }
  return Uint8Array.from(out)
}

const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]

/** 보안 난수 공급원. 기본값은 {@link defaultRandomHex}. 테스트에서 바꿔 끼운다. */
export type RandomHexSource = () => string

/**
 * 보안 난수 16진수 문자열(최소 32자). 1순위 `crypto.getRandomValues`(웹 등), 2순위 Expo 네이티브 UUID v4
 * (`globalThis.expo.uuidv4` — expo-modules-core 가 모든 바이너리에 설치). 둘 다 없으면 Math.random 으로
 * 대신하지 않고 throw 한다(예측 가능한 nonce 는 쓰지 않는다).
 */
export function defaultRandomHex(): string {
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto
  if (cryptoObj?.getRandomValues) {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(32))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  const nativeUuid = (globalThis as { expo?: { uuidv4?: () => string } }).expo?.uuidv4
  if (typeof nativeUuid === 'function') {
    // UUID v4 하나는 122비트 난수. 둘을 이어 244비트로 쓴다.
    return (nativeUuid() + nativeUuid()).replace(/-/g, '')
  }
  throw new Error('보안 난수를 만들 수 없는 환경입니다.')
}

export interface AppleNonce {
  /** 서버로 보낼 원본 */
  raw: string
  /** Apple(signInAsync)에 넘길 sha256(raw) */
  hashed: string
}

export function createAppleNonce(randomHex: RandomHexSource = defaultRandomHex): AppleNonce {
  const raw = randomHex()
  if (!/^[0-9a-f]{32,}$/i.test(raw)) throw new Error('nonce 난수 형식이 올바르지 않습니다.')
  return { raw, hashed: sha256Hex(raw) }
}

/** expo-apple-authentication 의 credential 중 서버로 보내는 부분(타입을 패키지에서 import 하지 않으려고 따로 둔다). */
export interface AppleCredentialLike {
  identityToken: string | null
  authorizationCode: string | null
  fullName: { givenName?: string | null; familyName?: string | null } | null
}

/** `POST /auth/apple` 요청 본문. 백엔드 AppleLoginRequest 와 같은 모양. */
export interface AppleLoginRequestBody {
  identityToken: string
  authorizationCode?: string
  fullName?: { givenName?: string; familyName?: string }
  nonce: string
}

export function buildAppleLoginRequest(credential: AppleCredentialLike, rawNonce: string): AppleLoginRequestBody {
  if (!credential.identityToken) throw new Error('Apple 로그인 응답에 identity token 이 없습니다.')
  const body: AppleLoginRequestBody = { identityToken: credential.identityToken, nonce: rawNonce }
  if (credential.authorizationCode) body.authorizationCode = credential.authorizationCode
  // 이름은 Apple 이 "처음 동의할 때" 한 번만 준다. 비어 있으면 아예 보내지 않는다.
  const givenName = credential.fullName?.givenName?.trim() || undefined
  const familyName = credential.fullName?.familyName?.trim() || undefined
  if (givenName || familyName) body.fullName = { givenName, familyName }
  return body
}
