import { useState } from 'react'
import { getErrorMessage } from '../../../apis/client'
import { updateFeedbackStatus } from '../../api'
import type { AdminFeedback } from '../../types'
import { OFFICIAL_REQUEST_PREFIX, infoSuggestTypeOf } from '../../../constants/feedback'

/** FeedbackCard 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useFeedbackCard({ item, onUpdated }: Pick<{
  item: AdminFeedback
  movedOut: boolean
  highlighted?: boolean
  onUpdated: (item: AdminFeedback) => void
}, 'item' | 'onUpdated'>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 공식 계정 신청에 공식 이름을 붙이는 중(입력 막대 열림). */
  const [appointing, setAppointing] = useState(false)
  /** 방금 붙인 공식 이름(카드에 결과를 보여 준다). */
  const [appointedName, setAppointedName] = useState<string | null>(null)
  const resolved = item.status === 'RESOLVED'
  // 설정 > 정보 제보하기로 들어온 문의면 종류(제휴·전시·행사·시설 정보·기타)를 표시한다.
  const suggestType = infoSuggestTypeOf(item.content)
  const officialRequest = item.content.startsWith(OFFICIAL_REQUEST_PREFIX)
  // 로그인해서 보낸 신청만 그 계정에 붙일 수 있다(탈퇴한 작성자는 userId 가 없다).
  const canAppoint = officialRequest && item.userId !== null && !resolved

  const toggle = () => {
    setPending(true)
    setError(null)
    updateFeedbackStatus(item.id, resolved ? 'OPEN' : 'RESOLVED')
      .then(onUpdated)
      .catch((err: unknown) => setError(getErrorMessage(err, '상태를 바꾸지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setPending(false))
  }
  return {
    pending,
    error,
    setError,
    appointing,
    setAppointing,
    appointedName,
    setAppointedName,
    resolved,
    suggestType,
    officialRequest,
    canAppoint,
    toggle,
  }
}
