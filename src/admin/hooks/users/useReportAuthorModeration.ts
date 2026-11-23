import { useState } from 'react'
import { fetchUser } from '../../api'
import type { AdminUser } from '../../types'
import { moderationError } from '../../utils/common/moderationErrors'

/** ReportAuthorModeration 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportAuthorModeration({ authorId }: Pick<{ authorId: number }, 'authorId'>) {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchUser(authorId)
      .then(setUser)
      .catch((err: unknown) => setError(moderationError(err, '작성자 정보를 불러오지 못했습니다.')))
      .finally(() => setLoading(false))
  }
  return { open, setOpen, user, setUser, loading, error, load }
}
