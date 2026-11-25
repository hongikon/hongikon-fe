import { useCallback, useEffect, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { completeLogin, logout, setMockMode, subscribeAdminAuth } from '../../api'
import { clearMockMode, getTokens, resolveMockMode, type MockMode } from '../../session'
import { useConsoleOverview } from './useConsoleOverview'
import { useSectionRoute } from './useSectionRoute'
import { useAdminDocumentHead } from './useAdminDocumentHead'
import { takeAuthCodeFromUrl, exchangeErrorMessage, WIDE_BREAKPOINT, type Phase } from '../../utils/shell/adminApp'

/** AdminApp 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useAdminApp() {
  useAdminDocumentHead()
  const { width } = useWindowDimensions()
  const wide = width >= WIDE_BREAKPOINT

  const [phase, setPhase] = useState<Phase>('booting')
  const [mockMode, setMockModeState] = useState<MockMode | null>(null)
  const [loginMessage, setLoginMessage] = useState<string | null>(null)
  const { section, navigate } = useSectionRoute()

  // ── 시작: 목업 / ?code= / 저장된 토큰 ──
  useEffect(() => {
    const mode = resolveMockMode()
    setMockMode(mode)
    setMockModeState(mode)
    if (mode) {
      setPhase('ready')
      return
    }
    const code = takeAuthCodeFromUrl()
    if (!code) {
      setPhase(getTokens() ? 'ready' : 'signedOut')
      return
    }
    let cancelled = false
    setPhase('exchanging')
    completeLogin(code)
      .then(() => {
        if (!cancelled) setPhase('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoginMessage(exchangeErrorMessage(error))
        setPhase('signedOut')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── 401(재발급 실패) / 403 은 어느 화면에서 나든 여기서 받는다 ──
  useEffect(
    () =>
      subscribeAdminAuth((event) => {
        if (event === 'forbidden') {
          setPhase('forbidden')
        } else {
          setLoginMessage('로그인이 만료되었습니다. 다시 로그인해주세요.')
          setPhase('signedOut')
        }
      }),
    [],
  )

  // ── 대시보드 수치 + 메뉴 배지. 처리 작업 뒤 각 화면이 refresh 를 부른다 ──
  const { overview, setOverview, overviewState, refreshOverview } = useConsoleOverview(phase === 'ready')

  const handleLogout = useCallback(async () => {
    await logout()
    if (mockMode) {
      clearMockMode()
      setMockMode(null)
      setMockModeState(null)
    }
    setOverview(null)
    setLoginMessage(null)
    setPhase('signedOut')
  }, [mockMode])
  return {
    wide,
    phase,
    mockMode,
    loginMessage,
    section,
    navigate,
    overview,
    overviewState,
    refreshOverview,
    handleLogout,
  }
}
