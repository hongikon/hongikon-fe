import { useState } from 'react'
import { setOfficialName } from '../../api'
import type { AdminUser } from '../../types'
import { useAdminHost } from '../../ui'
import { officialError } from '../../utils/common/moderationErrors'

/** OfficialNameForm 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useOfficialNameForm({ userId, initialName = '', onDone }: Pick<{
  userId: number
  initialName?: string
  onDone: (user: AdminUser) => void
  onCancel: () => void
}, 'userId' | 'initialName' | 'onDone'>) {
  const app = useAdminHost() === 'app'
  const [draft, setDraft] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const name = draft.trim()
    if (name.length < 2) {
      setError('공식 이름을 2자 이상 입력해주세요.')
      return
    }
    setBusy(true)
    setError(null)
    setOfficialName(userId, name)
      .then(onDone)
      .catch((err: unknown) => setError(officialError(err, '공식 계정으로 지정하지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setBusy(false))
  }
  return { app, draft, setDraft, busy, error, submit }
}
