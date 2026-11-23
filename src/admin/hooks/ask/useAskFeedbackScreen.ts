import { useState } from 'react'

/** AskFeedbackScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useAskFeedbackScreen() {
  const [view, setView] = useState<'feedback' | 'report' | 'notes'>('feedback')
  const [draftQuestion, setDraftQuestion] = useState<string | null>(null)
  return { view, setView, draftQuestion, setDraftQuestion }
}
