import { ApiError, getErrorMessage } from '../../../apis/client'
import { isAdminMapMissing } from '../../api'

/** 저장·삭제 실패 문구. 서버가 준 짧은 안내(검증 실패·중복 등)가 있으면 그걸 보여 준다. */
export function mapWriteErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.serverMessage) return error.serverMessage
  if (error instanceof ApiError && error.status === 409) return '같은 코드가 이미 있어요. 다른 코드를 쓰거나 비워 두세요.'
  if (isAdminMapMissing(error)) return '서버에 지도 관리 기능이 아직 배포되지 않았습니다.'
  return getErrorMessage(error, fallback)
}

export function mapLoadErrorMessage(error: unknown, fallback: string): string {
  if (isAdminMapMissing(error)) return '서버에 지도 관리 기능이 아직 배포되지 않았습니다.'
  return getErrorMessage(error, fallback)
}
