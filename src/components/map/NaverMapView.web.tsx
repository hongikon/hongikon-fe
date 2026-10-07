import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { useReconnect } from '../../lib/connectivity'

export interface NaverMapViewHandle {
  injectJavaScript: (js: string) => void
}

interface Props {
  html: string
  onMessage: (event: { nativeEvent: { data: string } }) => void
  /** 지도 스크립트를 처음 실행한 뒤 한 번 부른다(그 전에 보낸 마커·이동 명령을 다시 보내게). */
  onReady?: () => void
}

/**
 * 외부 스크립트(네이버 maps.js)를 한 번만 불러온다. 화면이 다시 붙을 때 태그가 이미 있어도
 * 아직 내려받는 중일 수 있어, 태그가 있다는 것만으로 끝났다고 보지 않고 실제 로드를 기다린다.
 * 실패한 태그는 지워 다음에 다시 시도할 수 있게 한다.
 */
function loadExternalScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === '1' || (window as any).naver?.maps) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => {
      s.dataset.loaded = '1'
      resolve()
    }
    s.onerror = (error) => {
      s.remove()
      reject(error)
    }
    document.head.appendChild(s)
  })
}

/** 이 시간 안에 maps.js 가 안 오면 실패로 보고 다시 시도한다(네이티브 READY_TIMEOUT_MS 와 같다). */
const LOAD_TIMEOUT_MS = 12_000
/** 자동으로 다시 시도하는 횟수와 간격. 넘으면 "다시 시도" 버튼을 띄우고 멈춘다. */
const AUTO_RETRY_DELAYS_MS = [1_500, 4_000]

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout()
      reject(new Error('timeout'))
    }, ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

/** 지도 페이지 스크립트가 실제로 지도를 만들었는지. #map div 가 이름으로 window.map 에 잡히므로 인스턴스까지 본다. */
function isMapReady(): boolean {
  const w = window as any
  return (
    typeof w.handleNativeMessage === 'function' &&
    !!w.naver?.maps?.Map &&
    w.map instanceof w.naver.maps.Map
  )
}

function injectInlineScript(code: string) {
  const s = document.createElement('script')
  s.textContent = code
  // appendChild 시점에 동기적으로 실행되므로, 실행 뒤 태그를 지워도 효과는 남는다.
  // 제휴 칩을 누를 때마다 주입되는데, 지우지 않으면 head 에 태그가 계속 쌓인다.
  document.head.appendChild(s)
  s.remove()
}

function extractExternalSrc(html: string): string | null {
  const m = html.match(/<script[^>]+src=["']([^"']+)["']/)
  return m ? m[1] : null
}

function extractInlineScript(html: string): string {
  const parts: string[] = []
  const re = /<script(?:\s(?!src)[^>]*)?>([^]*?)<\/script>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    if (m[1].trim()) parts.push(m[1])
  }
  return parts.join('\n')
}

const NaverMapView = forwardRef<NaverMapViewHandle, Props>(({ html, onMessage, onReady }, ref) => {
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

  return (
    <View style={styles.container}>
      <div
        id="map"
        style={{ width: '100%', height: '100%' } as React.CSSProperties}
      />
      {status === 'failed' && (
        <View style={styles.overlay}>
          <Text style={styles.title}>지도를 불러오지 못했어요</Text>
          <Text style={styles.body}>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => retry(true)}
            accessibilityRole="button"
            accessibilityLabel="지도 다시 불러오기"
          >
            <Text style={styles.buttonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    paddingHorizontal: 32,
  },
  title: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  body: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  buttonText: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.white },
})

export default NaverMapView
