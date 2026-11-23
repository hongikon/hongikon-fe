import { ApiError, getErrorMessage } from '../../../apis/client'

/** 서버에 회원 관리 API 가 아직 없을 때(배포 전) 보여 줄 문구. */
export function moderationError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
    return '회원을 찾을 수 없거나, 서버에 회원 관리 기능이 아직 배포되지 않았습니다.'
  }
  return getErrorMessage(err, fallback)
}

/**
 * 관리자 지정·해제 오류 문구. 400 은 서버가 쓴 이유(자기 자신 해제, 정지된 회원 지정)를 그대로 보여 준다.
 * 회원은 이미 불러와 있으니 404/405 는 "경로가 없다" — 서버가 아직 배포 전이다. 앱 토큰으로 보낼 때는
 * 없는 경로를 Spring `/error` 가 401 로 돌려주기도 해서, 재발급 뒤에도 401 이면 같은 경우로 본다.
 */
export function roleError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 404 || err.status === 405 || (err.status === 401 && err.afterTokenRefresh)) {
      return '서버 업데이트 후 사용할 수 있어요.'
    }
    if (err.status === 400 && err.serverMessage) return err.serverMessage
  }
  return getErrorMessage(err, fallback)
}

/**
 * 공식 계정 지정·해제 오류 문구. 409 는 같은 공식 이름이 이미 있음, 400 은 서버가 쓴 이유(이름 길이, 신청하지 않은 회원),
 * 404/405 는 이 기능 전 서버.
 */
export function officialError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return '같은 공식 이름을 쓰는 계정이 이미 있습니다. 다른 이름을 입력해주세요.'
    if (err.status === 400) return err.serverMessage || '공식 이름은 2~30자로 입력해주세요.'
    if (err.status === 404 || err.status === 405) return '서버가 아직 공식 계정 기능을 지원하지 않습니다. 서버 업데이트 후 다시 시도해주세요.'
  }
  return fallback
}

/**
 * 열람 오류 문구. 이 기능 전 서버는 경로가 없어 404/405(앱 토큰이면 재발급 뒤 401) — 그때는 업데이트 안내.
 * 서버가 이유를 적어 보낸 404(없는 회원 등)는 그 문구를 그대로 보여 준다.
 */
export function revealError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404 && err.serverMessage) return err.serverMessage
    if (err.status === 404 || err.status === 405 || (err.status === 401 && err.afterTokenRefresh)) {
      return '서버 업데이트 후 사용할 수 있어요.'
    }
  }
  return getErrorMessage(err, '로그인 닉네임을 불러오지 못했습니다. 다시 시도해주세요.')
}
