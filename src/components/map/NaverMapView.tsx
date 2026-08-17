import { forwardRef, useImperativeHandle, useRef } from 'react'
import { WebView } from 'react-native-webview'
import type { WebView as WebViewType } from 'react-native-webview'
import { MAP_PAGE_URL } from '../../constants/map'

export interface NaverMapViewHandle {
  injectJavaScript: (js: string) => void
}

interface Props {
  html: string
  onMessage: (event: { nativeEvent: { data: string } }) => void
}

/**
 * html prop은 안 쓴다(웹 빌드용 NaverMapView.web.tsx만 씀).
 * 인라인 HTML을 WKWebView에 넣으면 요청 origin이 비어 네이버 지도 도메인
 * 인증이 항상 실패해, 대신 실제 도메인(MAP_PAGE_URL)에서 원격으로 불러온다.
 */
const NaverMapView = forwardRef<NaverMapViewHandle, Props>(({ onMessage }, ref) => {
  const webViewRef = useRef<WebViewType>(null)

  useImperativeHandle(ref, () => ({
    injectJavaScript: (js: string) => {
      webViewRef.current?.injectJavaScript(js)
    },
  }))

  return (
    <WebView
      ref={webViewRef}
      style={{ flex: 1 }}
      source={{ uri: MAP_PAGE_URL }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      onMessage={onMessage}
      scrollEnabled={false}
    />
  )
})

export default NaverMapView
