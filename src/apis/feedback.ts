import { apiRequest } from './client'

export interface SubmitFeedbackInput {
  content: string
  /** 답변받을 이메일 등 연락처. 선택 입력. */
  contact?: string
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
