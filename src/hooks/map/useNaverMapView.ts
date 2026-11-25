import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type { WebView as WebViewType } from 'react-native-webview'
import { useReconnect } from '../../lib/connectivity'
import { MAX_AUTO_RELOADS, READY_TIMEOUT_MS, CRASH_WINDOW_MS, MAX_CRASH_RELOADS, ALIVE_MESSAGE, READY_MESSAGE, ALIVE_TIMEOUT_MS, ALIVE_PROBE_JS } from '../../utils/map/naverMapView'
import type { ForwardedRef } from 'react'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import type { Props } from '../../components/map/NaverMapView'

/** NaverMapView 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNaverMapView({ onMessage, onReady }: Pick<Props, 'onMessage' | 'onReady'>, ref: ForwardedRef<NaverMapViewHandle>) {
  const webViewRef = useRef<WebViewType>(null)
  const readyRef = useRef(false)
  const autoReloadsRef = useRef(0)
  const crashTimesRef = useRef<number[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [failed, setFailed] = useState(false)
  const [reloading, setReloading] = useState(false)

  useImperativeHandle(ref, () => ({
    injectJavaScript: (js: string) => {
      webViewRef.current?.injectJavaScript(js)
    },
  }))

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (aliveTimerRef.current) {
      clearTimeout(aliveTimerRef.current)
      aliveTimerRef.current = null
    }
  }, [])

  const reload = useCallback(
    (manual: boolean) => {
      clearTimer()
      if (manual) {
        autoReloadsRef.current = 0
      } else if (autoReloadsRef.current >= MAX_AUTO_RELOADS) {
        setReloading(false)
        setFailed(true)
        return
      } else {
        autoReloadsRef.current += 1
      }
      readyRef.current = false
      setFailed(false)
      setReloading(true)
      webViewRef.current?.reload()
      // 제한 시간은 보통 onLoadStart 에서 다시 건다. 그런데 iOS 가 다시 불러오기를 미루거나 onLoadStart 를 보내지 않으면
      // (백그라운드에서 WebView 프로세스가 죽은 뒤 등) 타이머 없이 스피너만 남았다 — 여기서도 건다. 로딩이 시작되면 그쪽이 새로 건다.
      timerRef.current = setTimeout(() => {
        if (!readyRef.current) reloadRef.current(false)
      }, READY_TIMEOUT_MS)
    },
    [clearTimer],
  )
  const reloadRef = useRef(reload)
  reloadRef.current = reload

  /** 렌더러가 죽었다. 짧은 시간에 여러 번 죽으면 다시 불러오지 않고 "다시 시도" 버튼을 띄운다. */
  const handleCrash = useCallback(() => {
    const now = Date.now()
    crashTimesRef.current = [...crashTimesRef.current.filter((t) => now - t < CRASH_WINDOW_MS), now]
    if (crashTimesRef.current.length > MAX_CRASH_RELOADS) {
      clearTimer()
      readyRef.current = false
      setReloading(false)
      setFailed(true)
      return
    }
    reload(true)
  }, [clearTimer, reload])

  // 로딩이 시작될 때마다 제한 시간을 건다. 준비 신호가 오면 handleMessage 에서 푼다.
  const handleLoadStart = useCallback(() => {
    readyRef.current = false
    clearTimer()
    timerRef.current = setTimeout(() => {
      if (!readyRef.current) reload(false)
    }, READY_TIMEOUT_MS)
  }, [clearTimer, reload])

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      if (event.nativeEvent.data.includes(ALIVE_MESSAGE)) {
        if (aliveTimerRef.current) {
          clearTimeout(aliveTimerRef.current)
          aliveTimerRef.current = null
        }
        if (!event.nativeEvent.data.includes('"ok":true')) reload(true)
        return
      }
      if (event.nativeEvent.data.includes(READY_MESSAGE)) {
        if (!readyRef.current) {
          readyRef.current = true
          autoReloadsRef.current = 0
          clearTimer()
          setFailed(false)
          setReloading(false)
          onReady?.()
        }
        return
      }
      onMessage(event)
    },
    [clearTimer, onMessage, onReady, reload],
  )

  // 백그라운드에 있다 돌아왔는데 아직 지도가 없으면 한 번 더 시도한다.
  // 이미 떠 있던 지도도 백그라운드에 있는 동안 WebView 프로세스가 죽거나(iOS 메모리 정리, 안드로이드 렌더러 종료)
  // 지도 칸이 비어 흰 화면만 남을 수 있다. 종료 알림이 늘 오지는 않아서, 돌아올 때마다 페이지에 물어보고
  // 대답이 없거나 지도가 비었으면 다시 불러온다(11-18 버그).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      if (!readyRef.current) {
        reload(true)
        return
      }
      if (aliveTimerRef.current) clearTimeout(aliveTimerRef.current)
      aliveTimerRef.current = setTimeout(() => {
        aliveTimerRef.current = null
        if (readyRef.current) reload(true)
      }, ALIVE_TIMEOUT_MS)
      webViewRef.current?.injectJavaScript(ALIVE_PROBE_JS)
    })
    return () => sub.remove()
  }, [reload])

  // 오프라인이었다가 연결되면 한 번 더 시도한다.
  useReconnect(() => {
    if (!readyRef.current) reload(true)
  })

  useEffect(() => clearTimer, [clearTimer])
  return { webViewRef, crashTimesRef, failed, reloading, reload, handleCrash, handleLoadStart, handleMessage }
}
