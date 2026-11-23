import { formatMemberRef } from '../../format'
import type { AdminReport } from '../../types'

/**
 * 작성자: 앱에 보이는 이름 · 회원 번호(없으면 #id). 로그인 닉네임 원문은 보여 주지 않는다(개인정보 최소 처리) —
 * 필요하면 "작성자 관리" → "로그인 닉네임 보기". 예전 서버의 authorNickname 은 원문이라 쓰지 않는다.
 */
export function authorText(report: AdminReport): string {
  return formatMemberRef(report.authorDisplayName, report.authorMemberCode, report.authorId)
}
