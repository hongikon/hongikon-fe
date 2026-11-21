/**
 * 제휴업체·편의시설·전시·공지 관리 화면이 함께 쓰는 입력 검증 도우미(순수 함수).
 * 검증 규칙은 서버(지도 데이터 계약)와 같게 맞춰, 보내기 전에 화면에서 먼저 알려 준다. 서버도 같은 규칙으로 한 번 더 막는다.
 * 입력 부품과 오류 문구는 MapForm.tsx 에 있고, 거기서 이 함수들도 다시 내보낸다.
 */

/** 좌표 범위(서버와 같다). 한국 밖 값이나 위도·경도를 뒤바꿔 넣은 실수를 막는다. */
export const LAT_RANGE = [33, 39] as const
export const LNG_RANGE = [124, 132] as const

/**
 * 입력한 좌표 문자열을 숫자로. 사용자가 확인해 준 값이라 반올림·자르기를 하지 않는다(Number 로만 바꾼다).
 * 비었으면 null, 숫자가 아니거나 범위 밖이면 오류 문구.
 */
export function parseCoordinate(text: string, range: readonly [number, number], label: string): number | null | string {
  const trimmed = text.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return `${label}는 숫자로 입력해 주세요.`
  if (value < range[0] || value > range[1]) return `${label}는 ${range[0]}~${range[1]} 사이여야 해요.`
  return value
}

/** 빈 문자열은 보내지 않는다(서버에 NULL 로 저장된다). */
export function optional(text: string): string | undefined {
  const trimmed = text.trim()
  return trimmed ? trimmed : undefined
}

/** 길이 초과면 오류 문구. */
export function tooLong(text: string, max: number, label: string): string | null {
  return text.trim().length > max ? `${label}은(는) ${max}자까지 쓸 수 있어요.` : null
}

/** 링크 이름·주소 검증(제휴업체·전시 공통): https 만, 이름과 주소는 같이 넣는다. */
export function linkErrors(linkLabel: string, linkUrl: string): string[] {
  const errors: string[] = []
  if (linkUrl && !linkUrl.startsWith('https://')) errors.push('링크 주소는 https:// 로 시작해야 해요.')
  if (linkUrl && !linkLabel) errors.push('링크 이름을 입력해 주세요(버튼에 보이는 글자).')
  if (!linkUrl && linkLabel) errors.push('링크 주소를 입력해 주세요.')
  return errors
}

/** 화면 검증 결과. 통과하면 요청 본문, 아니면 오류 문구 목록. */
export type BuildResult<I> = { input: I } | { errors: string[] }
