import { useCallback, useEffect, useState } from 'react'
import type { AdminSection } from '../../types'
import { SECTION_PATHS, sectionFromPath } from '../../utils/shell/adminSections'

/**
 * 웹 콘솔의 화면 전환. react-navigation 대신 history API 로 한다 — 주소창 경로(`/admin/reports` 등)와
 * 뒤로 가기가 그대로 맞아야 해서다.
 */
export function useSectionRoute() {
  const [section, setSection] = useState<AdminSection>(() => sectionFromPath(window.location.pathname))

  // ── 뒤로/앞으로 가기 ──
  useEffect(() => {
    const onPopState = () => setSection(sectionFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((next: AdminSection) => {
    setSection(next)
    const path = SECTION_PATHS[next]
    if (window.location.pathname !== path) window.history.pushState(null, '', path)
  }, [])

  return { section, navigate }
}
