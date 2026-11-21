import { getErrorMessage, isNetworkError, ApiError } from '../../../apis/client'

/**
 * 웹 관리자 콘솔(`/admin`). App.tsx 가 경로를 보고 앱의 AuthProvider/내비게이션을
 * 통째로 건너뛰어 이 컴포넌트만 그린다. 로그인·토큰도 앱과 따로 관리한다(`session.ts`).
 *
 * 화면 전환은 react-navigation 대신 history API 로 한다 — 섹션 4개뿐이고,
 * 주소창 경로(`/admin/reports` 등)와 뒤로 가기가 그대로 맞아야 해서다.
 */

export type Phase =
  /** 목업 여부·저장된 토큰·?code= 를 확인하는 중 */
  | 'booting'
  /** 카카오 로그인에서 돌아와 1회용 코드를 토큰으로 바꾸는 중 */
  | 'exchanging'
  | 'signedOut'
  /** 로그인은 됐지만 ADMIN 이 아니다(403) */
  | 'forbidden'
  | 'ready'

/** 이 너비부터 왼쪽 사이드바, 그보다 좁으면 위쪽 가로 메뉴. */
export const WIDE_BREAKPOINT = 860

/** 로그인 코드는 1회용이라, 새로고침·방문 기록에 남지 않게 주소에서 바로 지운다. */
export function takeAuthCodeFromUrl(): string | null {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  if (!code) return null
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return code
}

export function exchangeErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return '네트워크 연결이 불안정해 로그인을 마치지 못했습니다. 다시 로그인해주세요.'
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return '로그인 정보가 만료되었거나 올바르지 않습니다. 다시 로그인해주세요.'
  }
  return getErrorMessage(error, '로그인 처리 중 문제가 생겼습니다. 다시 로그인해주세요.')
}
