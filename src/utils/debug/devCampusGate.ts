/**
 * `/dev/sogang`·`/dev/yonsei`·`/dev/ewha` 앞의 인증키 입력(10-14 요청, 세 곳 같은 키). 키 원문은 저장소에 두지 않고 SHA-256 값만 둔다 — 키는 운영자가 따로 전한다.
 * 키를 맞히기 전에는 학교 데이터·화면 코드(`DevCampusScreen`)를 내려받지 않는다.
 * 다만 정적 웹이라 진짜 잠금은 아니다(번들 파일 주소를 알면 받을 수 있다). 학교가 공개한 정보를 링크 없이 숨겨 두는 정도의 용도.
 * 키를 바꾸려면 새 키의 SHA-256(`printf '%s' 새키 | shasum -a 256`)으로 아래 값을 바꾼다.
 */
export const KEY_SHA256 = '6b980606c6e01c1c613834d4b1546aae577730932517e62e6572c78cc0458dd5'

export const UNLOCK_KEY = '@hongikon_dev_campus_unlocked'

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function readUnlocked(): boolean {
  try {
    return window.sessionStorage.getItem(UNLOCK_KEY) === KEY_SHA256
  } catch {
    return false
  }
}
