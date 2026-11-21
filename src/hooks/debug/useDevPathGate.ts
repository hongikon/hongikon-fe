import { useEffect, useState } from 'react'
import { readRawKey, readUnlocked, TITLES } from '../../utils/debug/devPathGate'
import type { DevPathMode } from '../../utils/debug/devPathGate'

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
  return { unlocked, setUnlocked, rawKey, setRawKey, value, setValue, error, setError, checking, setChecking }
}
