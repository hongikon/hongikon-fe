import { useEffect, useState } from 'react'
import { CAMPUS_PREVIEW_NAMES, type CampusPreviewKey } from '../../debug/campusPreview'
import { readUnlocked } from '../../utils/debug/devCampusGate'

/** DevCampusGate 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDevCampusGate({ campus }: Pick<{ campus: CampusPreviewKey }, 'campus'>) {
  const name = CAMPUS_PREVIEW_NAMES[campus]
  const [unlocked, setUnlocked] = useState(readUnlocked)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])
  return { name, unlocked, setUnlocked, value, setValue, error, setError, checking, setChecking }
}
