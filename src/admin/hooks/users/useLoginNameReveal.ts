import { useState } from 'react'
import { revealLoginName } from '../../api'
import type { AdminLoginName } from '../../types'
import { revealError } from '../../utils/common/moderationErrors'

/** LoginNameReveal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useLoginNameReveal({ userId }: Pick<{ userId: number }, 'userId'>) {
  const [value, setValue] = useState<AdminLoginName | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reveal = () => {
    setLoading(true)
    setError(null)
    revealLoginName(userId)
      .then(setValue)
      .catch((err: unknown) => setError(revealError(err)))
      .finally(() => setLoading(false))
  }
  return { value, setValue, loading, error, reveal }
}
