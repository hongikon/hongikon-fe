export const KEY_SHA256 = '6b980606c6e01c1c613834d4b1546aae577730932517e62e6572c78cc0458dd5'

export const UNLOCK_KEY = '@hongikon_dev_path_unlocked'

/**
 * 입력한 암호키 원문(탭을 닫으면 지워지는 sessionStorage). /dev/ask 가 서버 LLM 분류(/ask/route)에 보내 서버가 SHA-256 으로 확인한다.
 * 개발 페이지라 이 탭 안에서만 둔다. 없으면(예전에 연 탭) 물어보기는 서버 없이 낱말 찾기만 한다.
 */
export const RAW_KEY = '@hongikon_dev_path_key'

export const TITLES: Record<DevPathMode, string> = { audit: '경로망 점검', survey: '경로망 현장 조사', surveyV3: '경로망 조사 v3', ask: '물어보기 미리보기' }

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** crypto.subtle only exists on https and localhost, so the key cannot be checked on a plain http LAN address. */
export function cannotCheckKey(): boolean {
  return typeof window !== 'undefined' && (window.isSecureContext === false || !globalThis.crypto?.subtle)
}

export function readRawKey(): string | undefined {
  try {
    return window.sessionStorage.getItem(RAW_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function readUnlocked(): boolean {
  try {
    return window.sessionStorage.getItem(UNLOCK_KEY) === KEY_SHA256
  } catch {
    return false
  }
}

/** 'ask' = `/dev/ask` 물어보기 챗봇 미리보기(같은 암호키). */
export type DevPathMode = 'audit' | 'survey' | 'surveyV3' | 'ask'
