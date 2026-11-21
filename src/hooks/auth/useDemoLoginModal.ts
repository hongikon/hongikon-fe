import { useState } from 'react'
import type { DemoLoginModalProps } from '../../components/auth/DemoLoginModal'

/** DemoLoginModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDemoLoginModal({ onClose, onSubmit }: Pick<DemoLoginModalProps, 'onClose' | 'onSubmit'>) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (pending) return
    setPassword('')
    setError(null)
    onClose()
  }

  const submit = async () => {
    if (pending || !username.trim() || !password) return
    setPending(true)
    setError(null)
    try {
      await onSubmit(username, password)
      setPassword('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    } finally {
      setPending(false)
    }
  }
  return { username, setUsername, password, setPassword, pending, error, close, submit }
}
