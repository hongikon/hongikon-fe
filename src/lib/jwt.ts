/**
 * JWT 본문(payload)을 서명 확인 없이 읽는다. 화면 표시용(회원 번호 등)으로만 쓰고, 권한 판단에는 쓰지 않는다 —
 * 권한은 늘 서버가 토큰을 검증해 정한다.
 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** base64url → 바이트. atob 가 없는 런타임(Hermes 구버전)도 있어 직접 계산한다. 잘못된 글자가 있으면 null. */
function decodeBase64Url(input: string): Uint8Array | null {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  if (base64.length % 4 === 1) return null
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of base64) {
    const value = BASE64_ALPHABET.indexOf(char)
    if (value < 0) return null
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return Uint8Array.from(bytes)
}

/** UTF-8 바이트 → 문자열. 잘못된 시퀀스면 null. */
function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    let encoded = ''
    for (const byte of bytes) encoded += `%${byte.toString(16).padStart(2, '0')}`
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}

/** 토큰의 payload 객체. 형식이 틀리면 null. */
export function decodeJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  const bytes = decodeBase64Url(parts[1])
  if (!bytes) return null
  const json = decodeUtf8(bytes)
  if (json === null) return null
  try {
    const parsed: unknown = JSON.parse(json)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * 액세스 토큰의 회원 번호(`sub`, 백엔드 JwtTokenProvider 가 userId 로 넣는다).
 * 양의 정수 문자열이 아니면 null — 화면에서 줄을 숨긴다.
 */
export function getUserIdFromToken(token: string | null | undefined): number | null {
  const sub = decodeJwtPayload(token)?.sub
  const text = typeof sub === 'number' ? String(sub) : sub
  if (typeof text !== 'string' || !/^[1-9]\d{0,15}$/.test(text)) return null
  const id = Number(text)
  return Number.isSafeInteger(id) ? id : null
}
