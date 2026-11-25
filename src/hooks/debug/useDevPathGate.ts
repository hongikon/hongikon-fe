import { useEffect, useState } from 'react'
import { readRawKey, readUnlocked, TITLES } from '../../utils/debug/devPathGate'
import type { DevPathMode } from '../../utils/debug/devPathGate'
import { sha256Hex, RAW_KEY, UNLOCK_KEY, KEY_SHA256 } from '../../utils/debug/devPathGate'

/** DevPathGate 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDevPathGate({ mode }: Pick<{ mode: DevPathMode }, 'mode'>) {
  const [unlocked, setUnlocked] = useState(readUnlocked)
  const [rawKey, setRawKey] = useState(readRawKey)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    document.title = `${TITLES[mode]} | 홍익온`
    return () => {
      meta.remove()
    }
  }, [mode])

  const submit = async () => {
    const key = value.trim()
    if (!key || checking) return
    setChecking(true)
    setError(null)
    try {
      if ((await sha256Hex(key)) !== KEY_SHA256) {
        setError('암호키가 맞지 않아요.')
        return
      }
      try {
        window.sessionStorage.setItem(UNLOCK_KEY, KEY_SHA256)
        window.sessionStorage.setItem(RAW_KEY, key)
      } catch {
        // 저장소를 사용할 수 없으면 새로고침 때 다시 암호키를 묻는다.
      }
      setRawKey(key)
      setUnlocked(true)
    } catch {
      setError('이 브라우저에서는 확인할 수 없어요. https 주소로 열어 주세요.')
    } finally {
      setChecking(false)
    }
  }
  return {
    unlocked,
    setUnlocked,
    rawKey,
    setRawKey,
    value,
    setValue,
    error,
    setError,
    checking,
    setChecking,
    submit,
  }
}
