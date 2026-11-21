import { useState } from 'react'
import { getErrorMessage } from '../../../apis/client'
import { createAskNote, updateAskNote } from '../../api'
import type { AdminAskNote } from '../../types'

/** AskNoteForm 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useAskNoteForm({ initialQuestion = '', askRef = null, note = null, onSaved }: Pick<{
  initialQuestion?: string
  askRef?: string | null
  note?: AdminAskNote | null
  onSaved: (note: AdminAskNote) => void
  onCancel: () => void
}, 'initialQuestion' | 'askRef' | 'note' | 'onSaved'>) {
  const [question, setQuestion] = useState(note?.question ?? initialQuestion)
  const [answer, setAnswer] = useState(note?.answer ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!question.trim() || !answer.trim()) {
      setError('질문과 답을 모두 적어 주세요.')
      return
    }
    setPending(true)
    setError(null)
    const request = note
      ? updateAskNote(note.id, { question: question.trim(), answer: answer.trim() })
      : createAskNote({ question: question.trim(), answer: answer.trim(), askRef })
    request
      .then(onSaved)
      .catch((err: unknown) => setError(getErrorMessage(err, '저장하지 못했습니다.')))
      .finally(() => setPending(false))
  }
  return { question, setQuestion, answer, setAnswer, pending, error, save }
}
