import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState, Platform } from 'react-native'
import { getErrorMessage, isCancelledError } from '../apis/client'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/common/Toast'
import { fetchOverview, setAdminAuthAdapter, setMockMode, subscribeAdminAuth } from './api'
import { resolveMockMode } from './session'
import { navigationRef } from '../navigation/navigationRef'
import {
  consumeAdminIntent,
  navigateToAdminTab,
  peekAdminIntent,
  subscribeAdminAlertReceived,
  subscribeAdminIntent,
} from '../lib/adminIntents'
import type { AdminOverview, OverviewState } from './types'

/**
 * 앱 안에서 "이 계정이 관리자인가"를 판단하고, 관리 탭이 쓸 대시보드 수치(overview)를 들고 있는다.
 *
 * 사용자 API 어디에도 역할(role)이 오지 않아, 로그인한 토큰으로 `GET /admin/overview` 를 보내 본다.
 * - 200 → 관리자(받은 수치는 탭 배지·대시보드에 그대로 쓴다)
 * - 403 → 관리자 아님
 * - 401 → 앱 재발급(AuthContext)이 처리한다. 재발급도 실패하면 거기서 로그아웃 → 여기 상태도 비운다.
 * - 네트워크 오류·404(관리자 API 없는 서버) 등 → 직전 판단을 유지한다(처음엔 "아님").
 *
 * 로그인 직후·토큰 복원 직후, 앱이 다시 앞으로 올 때(1분에 한 번까지), 관리 탭에 들어올 때마다 다시 묻는다.
 * 판단 결과와 수치는 메모리에만 둔다(기기에 저장하지 않는다) — 앱을 새로 켜면 항상 "아님"에서 시작해 다시 묻는다.
 * 권한 자체는 서버가 요청마다 확인하므로, 이 값은 탭을 보일지 정하는 데만 쓴다.
 */

/** 앱이 앞으로 올 때 다시 묻는 최소 간격 */
const FOREGROUND_PROBE_INTERVAL_MS = 60_000
/** 관리자로 확인된 뒤 관리 탭이 하단 탭에 붙기를 기다리는 최대 시간(관리자 알림 탭 처리) */
const ADMIN_TAB_WAIT_MS = 3_000

interface AdminAccessValue {
  isAdmin: boolean
  overview: OverviewState
}

const AdminAccessContext = createContext<AdminAccessValue | null>(null)

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const { status, accessToken, refreshAccessToken } = useAuth()
  /** 이번 로그인 세션에서 관리자 여부를 한 번이라도 물어 답(성공·실패)을 받았는지 — 관리자 알림 탭 처리용. */
  const [probed, setProbed] = useState(false)
  const [intentNonce, setIntentNonce] = useState(0)
  const toast = useToast()
  const authenticated = status === 'authenticated' && !!accessToken

  const [isAdmin, setIsAdmin] = useState(false)
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)

  const tokenRef = useRef<string | null>(null)
  const refreshRef = useRef(refreshAccessToken)
  const authenticatedRef = useRef(authenticated)
  const isAdminRef = useRef(false)
  /** 로그인 세션 번호. 로그아웃하면 올려서, 그 전에 보낸 요청의 결과를 버린다. */
  const generationRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const lastProbeAtRef = useRef(0)

  // 아래 effect 들보다 먼저 돌아야 한다(관리자 요청이 최신 토큰을 읽게).
  useEffect(() => {
    tokenRef.current = authenticated ? accessToken : null
    refreshRef.current = refreshAccessToken
    authenticatedRef.current = authenticated
  }, [authenticated, accessToken, refreshAccessToken])

  useEffect(() => {
    isAdminRef.current = isAdmin
  }, [isAdmin])

  // 관리자 API 가 앱 로그인 토큰·재발급을 쓰게 한다(웹 `/admin` 콘솔은 이 Provider 를 거치지 않아 자기 로그인을 쓴다).
  useEffect(() => {
    // 개발 웹에서 `/?mock=1` 이면 백엔드 없이 목업 관리자 API 로 돈다(`session.ts`). 운영 빌드는 항상 null.
    if (__DEV__ && Platform.OS === 'web') setMockMode(resolveMockMode())
    setAdminAuthAdapter({
      getAccessToken: () => tokenRef.current,
      refreshAccessToken: (expired) => refreshRef.current(expired),
    })
    return () => setAdminAuthAdapter(null)
  }, [])

  const reset = useCallback(() => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    lastProbeAtRef.current = 0
    setIsAdmin(false)
    setData(null)
    setLoading(false)
    setError(null)
    setUpdatedAt(null)
    setProbed(false)
  }, [])

  const refresh = useCallback(() => {
    if (!authenticatedRef.current) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const generation = generationRef.current
    lastProbeAtRef.current = Date.now()
    setLoading(true)
    fetchOverview(controller.signal)
      .then((overview) => {
        if (generation !== generationRef.current) return
        setIsAdmin(true)
        setData(overview)
        setError(null)
        setUpdatedAt(Date.now())
      })
      .catch((err: unknown) => {
        if (isCancelledError(err) || generation !== generationRef.current) return
        // 403 은 아래 subscribeAdminAuth 가 처리한다. 그 밖의 실패는 판단을 바꾸지 않는다.
        setError(getErrorMessage(err, '대시보드 정보를 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false)
        if (!controller.signal.aborted && generation === generationRef.current) setProbed(true)
      })
  }, [])

  // 로그인·토큰 복원 → 묻기, 로그아웃·게스트 → 비우기.
  useEffect(() => {
    if (authenticated) refresh()
    else reset()
  }, [authenticated, refresh, reset])

  // 관리자 요청 어디서든 403 이면(권한이 회수됨) 탭을 닫는다.
  useEffect(
    () =>
      subscribeAdminAuth((event) => {
        if (event !== 'forbidden') return
        const wasAdmin = isAdminRef.current
        isAdminRef.current = false
        setIsAdmin(false)
        setData(null)
        if (wasAdmin) toast.show({ message: '관리자 권한이 없어 관리 탭을 닫았어요.', tone: 'warning' })
      }),
    [toast],
  )

  // 앱이 다시 앞으로 오면(1분에 한 번까지) 다시 묻는다 — 권한 회수·부여와 대기 건수를 따라잡는다.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !authenticatedRef.current) return
      if (Date.now() - lastProbeAtRef.current < FOREGROUND_PROBE_INTERVAL_MS) return
      refresh()
    })
    return () => subscription.remove()
  }, [refresh])

  useEffect(() => () => abortRef.current?.abort(), [])

  // 앱이 켜져 있을 때 관리자 알림이 오면 배지·대시보드 수치를 바로 다시 받는다.
  useEffect(
    () =>
      subscribeAdminAlertReceived(() => {
        if (isAdminRef.current) refresh()
      }),
    [refresh],
  )

  /**
   * 관리자 알림(ADMIN_*)을 탭했는데 관리 탭이 아직 없을 때(콜드 스타트 — 관리자 확인 전) 여기서 마무리한다.
   * 확인이 끝나면 관리자는 관리 탭으로(섹션은 관리 탭이 요청을 꺼내 연다), 아니면 요청을 버리고 지도 탭 + 안내.
   * (관리 탭이 이미 있으면 알림 처리 쪽에서 바로 옮기고, 관리 탭이 요청을 꺼내 가 여기서는 할 일이 없다.)
   */
  useEffect(() => subscribeAdminIntent(() => setIntentNonce((n) => n + 1)), [])

  useEffect(() => {
    if (!peekAdminIntent() || status === 'loading') return
    // 로그인했는데 아직 답을 못 받았으면 기다린다(답이 오면 probed 가 바뀌어 다시 돈다).
    if (authenticated && !probed) return

    if (authenticated && isAdmin) {
      if (navigateToAdminTab()) return
      // 관리자로 바뀐 직후라 관리 탭이 아직 하단 탭에 안 붙었을 수 있다 — 잠깐 다시 시도한다.
      const startedAt = Date.now()
      const timer = setInterval(() => {
        if (!peekAdminIntent() || navigateToAdminTab() || Date.now() - startedAt > ADMIN_TAB_WAIT_MS) clearInterval(timer)
      }, 200)
      return () => clearInterval(timer)
    }

    // 관리자가 아니게 됐거나(권한 회수) 로그아웃·게스트, 또는 확인 요청이 실패했다.
    consumeAdminIntent()
    if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Map' })
    toast.show({ message: '관리자 권한을 확인하지 못해 지도를 열었어요.', tone: 'warning' })
  }, [intentNonce, status, authenticated, probed, isAdmin, toast])

  const value = useMemo<AdminAccessValue>(
    () => ({
      isAdmin: authenticated && isAdmin,
      overview: { data: authenticated ? data : null, loading, error, updatedAt, refresh },
    }),
    [authenticated, isAdmin, data, loading, error, updatedAt, refresh],
  )

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
}

function useAdminAccess(): AdminAccessValue {
  const ctx = useContext(AdminAccessContext)
  if (!ctx) throw new Error('useIsAdmin must be used within AdminAccessProvider')
  return ctx
}

/** 로그인한 계정이 관리자인지(서버에 물어 본 결과). 게스트·로그아웃이면 항상 false. */
export function useIsAdmin(): boolean {
  return useAdminAccess().isAdmin
}

/** 관리 탭 대시보드·배지가 쓰는 overview 와 다시 불러오기. */
export function useAdminOverview(): OverviewState {
  return useAdminAccess().overview
}
