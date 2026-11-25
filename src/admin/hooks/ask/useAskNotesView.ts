import { useEffect, useState } from 'react'
import { getErrorMessage, isCancelledError } from '../../../apis/client'
import { fetchAskNotes, updateAskNote } from '../../api'
import type { AdminAskNote } from '../../types'
import { upsertAskNote } from '../../utils/ask/askFeedback'

/** AskNotesView 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useAskNotesView({ draftQuestion, onDraftDone }: Pick<{ draftQuestion: string | null; onDraftDone: () => void }, 'draftQuestion' | 'onDraftDone'>) {
  const [notes, setNotes] = useState<AdminAskNote[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | 'new' | null>(draftQuestion !== null ? 'new' : null)
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<'ON' | 'ALL'>('ON')

  useEffect(() => {
    if (draftQuestion !== null) setEditing('new')
  }, [draftQuestion])

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetchAskNotes(controller.signal)
      .then(setNotes)
      .catch((err: unknown) => {
        if (!isCancelledError(err)) setError(getErrorMessage(err, '안내 목록을 불러오지 못했습니다.'))
      })
    return () => controller.abort()
  }, [reloadKey])

  const saved = (note: AdminAskNote) => {
    setNotes((prev) => upsertAskNote(prev, note))
    setEditing(null)
    onDraftDone()
  }

  const toggle = (note: AdminAskNote) =>
    updateAskNote(note.id, { active: !note.active })
      .then(saved)
      .catch((err: unknown) => setError(getErrorMessage(err, '바꾸지 못했습니다.')))

  const shown = (notes ?? []).filter((note) => filter === 'ALL' || note.active)
  return { notes, error, editing, setEditing, setReloadKey, filter, setFilter, saved, toggle, shown }
}
