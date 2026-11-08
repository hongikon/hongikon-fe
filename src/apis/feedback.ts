import { apiRequest } from './client'

export interface SubmitFeedbackInput {
  content: string
  /** 답변받을 이메일 등 연락처. 선택 입력. */
  contact?: string
  /** 참고 사진 키(uploadReportImage 로 받은 것, 최대 3장, 로그인 필요). */
  imageKeys?: string[]
  /** 물어보기에서 넘어온 문의면 그 답 기록('route:123' / 'flow:{clientId}'). 관리자 '물어보기 피드백'에 함께 보인다. */
  askRef?: string
}

/** 문의/피드백 전송. 백엔드에 동일 경로의 POST 핸들러가 없다면 여기 경로를 맞춰 바꿔야 한다. */
export function submitFeedback(
  input: SubmitFeedbackInput,
  accessToken?: string | null,
): Promise<void> {
  return apiRequest<void>('/feedback', {
    method: 'POST',
    body: input,
    accessToken,
  })
}
