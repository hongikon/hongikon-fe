import { useEffect, useState } from 'react'
import { CAMPUS_PREVIEW_NAMES, type CampusPreviewKey } from '../../debug/campusPreview'
import { readUnlocked } from '../../utils/debug/devCampusGate'
import { sha256Hex, UNLOCK_KEY, KEY_SHA256 } from '../../utils/debug/devCampusGate'

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

  const submit = async () => {
    const key = value.trim()
    if (!key || checking) return
    setChecking(true)
    try {
      if ((await sha256Hex(key)) !== KEY_SHA256) {
        setError('인증키가 맞지 않아요.')
        return
      }
      try {
        // 이 탭을 닫기 전까지만 기억한다.
        window.sessionStorage.setItem(UNLOCK_KEY, KEY_SHA256)
      } catch {
        // 저장소를 못 쓰면 새로고침 때 다시 묻는다.
      }
      setUnlocked(true)
    } catch {
      setError('이 브라우저에서는 확인할 수 없어요. https 주소로 열어 주세요.')
    } finally {
      setChecking(false)
    }
  }
  return { name, unlocked, setUnlocked, value, setValue, error, setError, checking, setChecking, submit }
}
