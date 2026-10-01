/**
 * 앱 닉네임 규칙과 제보 작성자 표시 이름.
 * 규칙은 백엔드 `AppNicknamePolicy`·`DisplayNames`(hongikon-be)와 같다. 바꾸면 양쪽을 함께 바꾼다.
 * 최종 판정은 서버가 한다. 여기 검사는 입력하면서 바로 안내하려는 용도다.
 */

export const APP_NICKNAME_MIN_LENGTH = 2
export const APP_NICKNAME_MAX_LENGTH = 12
/** 서버가 하루에 허용하는 닉네임 변경 횟수. 429 안내 문구에만 쓴다. */
export const APP_NICKNAME_DAILY_LIMIT = 5

const ALLOWED = /^[가-힣a-zA-Z0-9_]+$/
const RESERVED_WORDS = ['운영', '운영진', '관리자', 'admin', '홍익온', 'hongikon', '공식', '학교']

/** 작성자 이름이 비었을 때. 서버 `DisplayNames.ANONYMOUS` 와 같다. */
export const ANONYMOUS_NAME = '익명'

/** 코드포인트 단위 길이. 이모지(서로게이트 쌍)도 한 글자로 센다. */
function codePointLength(value: string): number {
  return Array.from(value).length
}

/** 앞뒤 공백을 지운 값. 비면 빈 문자열(= 앱 닉네임 지우기). */
export function normalizeAppNickname(raw: string): string {
  return raw.trim()
}

/** 규칙에 어긋나면 안내 문구, 맞으면 null. `normalizeAppNickname` 을 거친 값을 넣는다. */
export function validateAppNickname(nickname: string): string | null {
  const length = codePointLength(nickname)
  if (length < APP_NICKNAME_MIN_LENGTH || length > APP_NICKNAME_MAX_LENGTH) {
    return `닉네임은 ${APP_NICKNAME_MIN_LENGTH}~${APP_NICKNAME_MAX_LENGTH}자로 입력해 주세요.`
  }
  if (!ALLOWED.test(nickname)) {
    return '닉네임에는 한글, 영문, 숫자, 밑줄(_)만 쓸 수 있어요.'
  }
  const lower = nickname.toLowerCase()
  const compact = lower.replace(/_/g, '')
  const reserved = RESERVED_WORDS.find((word) => lower.includes(word) || compact.includes(word))
  if (reserved) {
    return `'${reserved}'처럼 운영진이나 학교로 오해할 수 있는 단어는 쓸 수 없어요.`
  }
  return null
}

/** "홍길동" → "홍**", "ab" → "a*", "홍" → "홍*", 빈 값 → "익명". */
export function maskNickname(name: string | null | undefined): string {
  const trimmed = name?.trim()
  if (!trimmed) return ANONYMOUS_NAME
  const chars = Array.from(trimmed)
  return chars[0] + '*'.repeat(Math.max(1, chars.length - 1))
}

/**
 * 제보 작성자로 보여 줄 이름.
 * 새 서버는 `authorDisplayName`(앱 닉네임 또는 이미 가린 이름)을 준다. 그대로 쓴다.
 * 그 전 서버는 `authorNickname` 에 카카오/Apple 닉네임 원문을 실어 보내므로 여기서 가린다.
 * 원문 대신 "익명"만 보내는 서버(백엔드 보안 점검 PR)도 있어 그 값은 가리지 않는다.
 */
export function reportAuthorName(report: { authorNickname?: string | null; authorDisplayName?: string | null }): string {
  if (report.authorDisplayName) return report.authorDisplayName
  if (report.authorNickname === ANONYMOUS_NAME) return ANONYMOUS_NAME
  return maskNickname(report.authorNickname)
}
