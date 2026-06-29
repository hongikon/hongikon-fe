import { forwardRef, useImperativeHandle, useRef } from 'react'
import { WebView } from 'react-native-webview'
import type { WebView as WebViewType } from 'react-native-webview'

export interface NaverMapViewHandle {
  injectJavaScript: (js: string) => void
}

interface Props {
  html: string
  onMessage: (event: { nativeEvent: { data: string } }) => void
}

const NaverMapView = forwardRef<NaverMapViewHandle, Props>(({ html, onMessage }, ref) => {
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
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      onMessage={onMessage}
      scrollEnabled={false}
    />
  )
})

export default NaverMapView
