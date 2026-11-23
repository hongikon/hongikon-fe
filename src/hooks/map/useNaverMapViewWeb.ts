import { useImperativeHandle, useRef, useEffect, useState } from 'react'
import { useReconnect } from '../../lib/connectivity'
import { loadExternalScript, withTimeout, isMapReady, injectInlineScript, extractExternalSrc, extractInlineScript, LOAD_TIMEOUT_MS, AUTO_RETRY_DELAYS_MS } from '../../utils/map/naverMapViewWeb'
import type { ForwardedRef } from 'react'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView.web'
import type { Props } from '../../components/map/NaverMapView.web'

/** NaverMapView 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNaverMapViewWeb({ html, onMessage, onReady }: Pick<Props, 'html' | 'onMessage' | 'onReady'>, ref: ForwardedRef<NaverMapViewHandle>) {
  const onMessageRef = useRef(onMessage)
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  const onReadyRef = useRef(onReady)
  useEffect(() => { onReadyRef.current = onReady }, [onReady])

  // 'loading' → 'ready' 또는 'failed'. 실패하면 "다시 시도" 화면을 띄운다(예전엔 빈 화면만 남았다).
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)
  const autoRetriesRef = useRef(0)
  const statusRef = useRef(status)
  statusRef.current = status

  useImperativeHandle(ref, () => ({
    injectJavaScript: (js: string) => {
      // 지도가 아직 없으면(로딩 중·실패) 건너뛴다. 뜨고 나면 onReady → resyncMap 이 상태를 다시 보낸다.
      if (typeof (window as any).handleNativeMessage !== 'function') return
      try {
        injectInlineScript(js)
      } catch (error) {
        if (__DEV__) console.warn('지도 스크립트 실행 실패:', error)
      }
    },
  }))

  const retry = (manual: boolean) => {
    if (manual) autoRetriesRef.current = 0
    setStatus('loading')
    setAttempt((a) => a + 1)
  }

  useEffect(() => {
    ;(window as any).ReactNativeWebView = {
      postMessage: (data: string) => onMessageRef.current({ nativeEvent: { data } }),
    }

    const src = extractExternalSrc(html)
    const inline = extractInlineScript(html)

    // 불러오는 사이 화면을 떠났으면 지도를 만들지 않는다(사라진 #map 에 지도가 생기는 것을 막는다).
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const init = async () => {
      if (src) {
        // 응답 없이 걸려 있는 태그는 지워야 다음 시도가 새로 받는다.
        await withTimeout(loadExternalScript(src), LOAD_TIMEOUT_MS, () => {
          document.querySelector(`script[src="${src}"]`)?.remove()
        })
        if (!(window as any).naver?.maps) throw new Error('naver.maps 없음')
      }
      if (cancelled) return
      injectInlineScript(inline)
      // 인라인 스크립트 안에서 난 오류(new naver.maps.Map 실패 등)는 여기로 안 올라오므로 결과로 확인한다.
      if (!isMapReady()) throw new Error('지도 초기화 실패')
      autoRetriesRef.current = 0
      setStatus('ready')
      // 지도가 뜨기 전에 보낸 명령(공유 링크 /r/{id} 로 연 제보로 옮기기 등)은 사라진다. 뜬 뒤 화면 상태를 다시 그리게 알린다.
      onReadyRef.current?.()
    }

    init().catch((error) => {
      if (__DEV__) console.warn('네이버 지도 스크립트를 불러오지 못했습니다:', error)
      if (cancelled) return
      const delay = AUTO_RETRY_DELAYS_MS[autoRetriesRef.current]
      if (delay !== undefined) {
        autoRetriesRef.current += 1
        retryTimer = setTimeout(() => retry(false), delay)
      } else {
        setStatus('failed')
      }
    })

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      ;(window as any).ReactNativeWebView = undefined
    }
  }, [attempt])

  // 오프라인이었다가 연결되면, 또는 탭으로 돌아왔는데 지도가 실패한 채면 한 번 더 시도한다.
  useReconnect(() => {
    if (statusRef.current === 'failed') retry(true)
  })
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'failed') retry(true)
    }
    const onOnline = () => {
      if (statusRef.current === 'failed') retry(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [])
  return { status, retry }
}
