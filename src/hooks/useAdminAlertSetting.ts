import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, isCancelledError } from '../apis/client'
import { getNotificationSettings, patchNotificationSettings } from '../apis/notificationSettings'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/common/Toast'

/**
 * 설정 > 알림의 "관리자 알림" 스위치(관리자 계정에만 보인다). 서버 `notification-settings.adminAlerts` 를 그대로 쓴다 —
 * 관리자에게만 의미가 있는 서버 설정이라 기기에 따로 저장하지 않는다(다른 제보 알림과 달리 게스트 때 고를 일이 없다).
 *
 * - `unsupported`: 서버가 아직 이 설정을 모른다(404·400, 또는 응답에 `adminAlerts` 가 없음) → 스위치를 숨긴다.
 * - `error`: 연결 문제 등으로 못 불러왔다 → 다시 시도할 수 있게 한다.
 * 바꾸면 화면을 먼저 바꾸고(낙관적) 실패하면 되돌린다.
 */
export type AdminAlertSettingState =
  | { status: 'loading' }
  | { status: 'ready'; enabled: boolean; saving: boolean }
  | { status: 'unsupported' }
  | { status: 'error' }

function isUnsupported(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400)
}

export function useAdminAlertSetting(active: boolean): {
  state: AdminAlertSettingState
  toggle: () => void
  retry: () => void
} {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [state, setState] = useState<AdminAlertSettingState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  // 토큰은 ref 로 읽는다 — 재발급으로 토큰이 바뀔 때마다 다시 부르지 않게(SettingsScreen 닉네임과 같은 이유).
  const tokenRef = useRef(accessToken)
  tokenRef.current = accessToken
  const loggedIn = !!accessToken
  const seqRef = useRef(0)

  useEffect(() => {
    const token = tokenRef.current
    if (!active || !token) return
    let cancelled = false
    setState({ status: 'loading' })
    getNotificationSettings(token)
      .then((server) => {
        if (cancelled) return
        setState(
          typeof server.adminAlerts === 'boolean'
            ? { status: 'ready', enabled: server.adminAlerts, saving: false }
            : { status: 'unsupported' },
        )
      })
      .catch((error: unknown) => {
        if (cancelled || isCancelledError(error)) return
        setState(isUnsupported(error) ? { status: 'unsupported' } : { status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [active, loggedIn, reloadKey])

  const toggle = useCallback(() => {
    const token = tokenRef.current
    if (state.status !== 'ready' || !token) return
    const previous = state.enabled
    const next = !previous
    const seq = ++seqRef.current
    setState({ status: 'ready', enabled: next, saving: true })
    patchNotificationSettings({ adminAlerts: next }, token)
      .then((server) => {
        if (seq !== seqRef.current) return
        setState(
          typeof server.adminAlerts === 'boolean'
            ? { status: 'ready', enabled: server.adminAlerts, saving: false }
            : { status: 'unsupported' },
        )
      })
      .catch((error: unknown) => {
        if (seq !== seqRef.current) return
        if (isUnsupported(error)) {
          setState({ status: 'unsupported' })
          return
        }
        setState({ status: 'ready', enabled: previous, saving: false })
        toast.show({ message: '관리자 알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', tone: 'warning' })
      })
  }, [state, toast])

  const retry = useCallback(() => setReloadKey((n) => n + 1), [])

  return { state, toggle, retry }
}
