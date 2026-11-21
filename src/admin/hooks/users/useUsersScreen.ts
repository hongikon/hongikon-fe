import { useEffect, useState } from 'react'
import { getErrorMessage, isCancelledError } from '../../../apis/client'
import { searchUsers } from '../../api'
import type { AdminUser } from '../../types'
import { useAdminHost } from '../../ui'

/** UsersScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useUsersScreen({ initialQuery = '' }: Pick<{ initialQuery?: string }, 'initialQuery'>) {
  const app = useAdminHost() === 'app'
  const [input, setInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    searchUsers(query, controller.signal)
      .then(setUsers)
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(getErrorMessage(err, '회원을 불러오지 못했습니다. 서버에 회원 관리 기능이 배포됐는지 확인해주세요.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [query, reloadKey])

  const submit = () => {
    setUsers(null)
    if (input.trim() === query) setReloadKey((key) => key + 1)
    else setQuery(input.trim())
  }

  const replace = (updated: AdminUser) =>
    setUsers((prev) => (prev ? prev.map((user) => (user.id === updated.id ? updated : user)) : prev))
  return { app, input, setInput, query, users, loading, error, setReloadKey, submit, replace }
}
