import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { View } from 'react-native'

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

  useImperativeHandle(ref, () => ({
    injectJavaScript: (js: string) => {
      injectInlineScript(js)
    },
  }))

  useEffect(() => {
    ;(window as any).ReactNativeWebView = {
      postMessage: (data: string) => onMessageRef.current({ nativeEvent: { data } }),
    }

    const src = extractExternalSrc(html)
    const inline = extractInlineScript(html)

    // 불러오는 사이 화면을 떠났으면 지도를 만들지 않는다(사라진 #map 에 지도가 생기는 것을 막는다).
    let cancelled = false
    const init = async () => {
      if (src) await loadExternalScript(src)
      if (cancelled) return
      injectInlineScript(inline)
      // 지도가 뜨기 전에 보낸 명령(공유 링크 /r/{id} 로 연 제보로 옮기기 등)은 사라진다. 뜬 뒤 화면 상태를 다시 그리게 알린다.
      onReadyRef.current?.()
    }

    init().catch((error) => {
      if (__DEV__) console.warn('네이버 지도 스크립트를 불러오지 못했습니다:', error)
    })

    return () => {
      cancelled = true
      ;(window as any).ReactNativeWebView = undefined
    }
  }, [])

  return (
    <View style={{ flex: 1 }}>
      <div
        id="map"
        style={{ width: '100%', height: '100%' } as React.CSSProperties}
      />
    </View>
  )
})

export default NaverMapView
