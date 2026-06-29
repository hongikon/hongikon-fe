import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { View } from 'react-native'

export interface NaverMapViewHandle {
  injectJavaScript: (js: string) => void
}

interface Props {
  html: string
  onMessage: (event: { nativeEvent: { data: string } }) => void
}

function loadExternalScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

function injectInlineScript(code: string) {
  const s = document.createElement('script')
  s.textContent = code
  document.head.appendChild(s)
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

const NaverMapView = forwardRef<NaverMapViewHandle, Props>(({ html, onMessage }, ref) => {
  const onMessageRef = useRef(onMessage)
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

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

    const init = async () => {
      if (src) await loadExternalScript(src)
      injectInlineScript(inline)
    }

    init()

    return () => {
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
