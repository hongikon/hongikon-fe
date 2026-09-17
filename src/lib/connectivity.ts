import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AppState, Platform } from 'react-native'
import { apiRequest, subscribeRequestOutcome } from '../apis/client'

/**
 * 앱 전역 연결 상태.
 * - online: 마지막 요청이 서버에 닿았다(또는 아직 실패한 적이 없다)
 * - offline: 기기 자체가 오프라인이라고 알려왔다(웹 `navigator.onLine` 만 가능)
 * - unreachable: 요청이 서버에 닿지 못했다(끊김·시간 초과·게이트웨이 오류)
 *
 * `@react-native-community/netinfo` 를 쓰지 않은 이유: 네이티브 모듈이라 개발 빌드를
 * 다시 만들어야 하고, 우리에게 중요한 건 "기기가 와이파이에 붙었나"가 아니라
 * "우리 서버에 닿나"라서 실제 요청 결과와 `/status` 핑이 더 정확한 신호다.
 */
export type ConnectivityStatus = 'online' | 'offline' | 'unreachable'

export interface ConnectivitySnapshot {
  status: ConnectivityStatus
  /** 사용자가 누른 재확인 또는 자동 재확인이 진행 중인지. */
  checking: boolean
}

/** 연결이 끊겼을 때 자동으로 다시 확인하는 간격. 점점 늘려 배터리·서버 부담을 줄인다. */
const AUTO_PROBE_DELAYS_MS = [5_000, 10_000, 20_000, 30_000]
/** 핑은 빨리 판정해야 배너가 오래 "확인 중"에 머물지 않는다. */
const PROBE_TIMEOUT_MS = 5_000

let snapshot: ConnectivitySnapshot = { status: 'online', checking: false }
const snapshotListeners = new Set<() => void>()
const reconnectListeners = new Set<() => void>()
let inFlightProbe: Promise<boolean> | null = null
let autoProbeTimer: ReturnType<typeof setTimeout> | null = null
let autoProbeAttempt = 0

function setSnapshot(next: ConnectivitySnapshot): void {
  if (next.status === snapshot.status && next.checking === snapshot.checking) return
  const wasDisconnected = snapshot.status !== 'online'
  snapshot = next
  snapshotListeners.forEach((listener) => listener())

  if (next.status === 'online') {
    stopAutoProbe()
    // 끊겼다가 다시 닿은 순간에만 알린다. 화면들은 이때 실패했던 요청을 다시 부른다.
    if (wasDisconnected) {
      reconnectListeners.forEach((listener) => {
        try {
          listener()
        } catch (error) {
          if (__DEV__) console.warn('[connectivity] 재연결 리스너 오류:', error)
        }
      })
    }
  } else if (!wasDisconnected) {
    // 막 끊긴 순간에만 자동 재확인을 건다. 이후 예약은 재확인 타이머가 스스로 이어간다.
    scheduleAutoProbe()
  }
}

function markStatus(status: ConnectivityStatus): void {
  setSnapshot({ ...snapshot, status })
}

function stopAutoProbe(): void {
  if (autoProbeTimer !== null) clearTimeout(autoProbeTimer)
  autoProbeTimer = null
  autoProbeAttempt = 0
}

function scheduleAutoProbe(): void {
  if (autoProbeTimer !== null) return
  // 백그라운드에서는 돌리지 않는다. 포그라운드로 돌아오면 AppState 리스너가 다시 확인한다.
  if (AppState.currentState !== 'active' && Platform.OS !== 'web') return

  const delay = AUTO_PROBE_DELAYS_MS[Math.min(autoProbeAttempt, AUTO_PROBE_DELAYS_MS.length - 1)]
  autoProbeTimer = setTimeout(() => {
    autoProbeTimer = null
    autoProbeAttempt += 1
    void checkConnectivity().then((ok) => {
      if (!ok) scheduleAutoProbe()
    })
  }, delay)
}

/**
 * 서버에 닿는지 `/status` 로 확인한다. 동시에 여러 곳에서 불러도 핑은 한 번만 보낸다.
 * 핑 결과는 client 의 요청 결과 구독으로 상태에 반영되고, 여기선 성공 여부만 돌려준다.
 */
export function checkConnectivity(): Promise<boolean> {
  if (inFlightProbe) return inFlightProbe

  setSnapshot({ ...snapshot, checking: true })
  inFlightProbe = apiRequest<unknown>('/status', { retries: 0, timeoutMs: PROBE_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      inFlightProbe = null
      setSnapshot({ ...snapshot, checking: false })
    })
  return inFlightProbe
}

export function getConnectivity(): ConnectivitySnapshot {
  return snapshot
}

export function subscribeConnectivity(listener: () => void): () => void {
  snapshotListeners.add(listener)
  return () => {
    snapshotListeners.delete(listener)
  }
}

/** 끊겼던 연결이 돌아왔을 때 불릴 콜백을 등록한다. */
export function onReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener)
  return () => {
    reconnectListeners.delete(listener)
  }
}

subscribeRequestOutcome((outcome) => {
  if (outcome === 'reachable') {
    markStatus('online')
    return
  }
  // 웹에서 브라우저가 오프라인이라고 알고 있으면 더 구체적인 안내를 쓴다.
  const browserOffline =
    Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false
  markStatus(browserOffline ? 'offline' : 'unreachable')
})

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('offline', () => markStatus('offline'))
  // 브라우저 "온라인"은 공유기에만 붙어도 뜨므로 믿지 않고 실제로 서버에 닿는지 확인한다.
  window.addEventListener('online', () => {
    if (snapshot.status !== 'online') void checkConnectivity()
  })
}

AppState.addEventListener('change', (state) => {
  if (state !== 'active') {
    if (autoProbeTimer !== null) clearTimeout(autoProbeTimer)
    autoProbeTimer = null
    return
  }
  if (snapshot.status !== 'online') {
    void checkConnectivity().then((ok) => {
      if (!ok) scheduleAutoProbe()
    })
  }
})

export function useConnectivity(): ConnectivitySnapshot {
  return useSyncExternalStore(subscribeConnectivity, getConnectivity, getConnectivity)
}

/**
 * 연결이 돌아오면 `callback` 을 부른다. 콜백이 매 렌더 바뀌어도 구독을 다시 걸지 않게 ref 로 든다.
 */
export function useReconnect(callback: () => void, enabled = true): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    return onReconnect(() => callbackRef.current())
  }, [enabled])
}
