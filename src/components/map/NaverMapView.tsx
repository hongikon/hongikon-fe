import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { WebView as WebViewType } from 'react-native-webview'
import { MAP_PAGE_URL } from '../../constants/map'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { useReconnect } from '../../lib/connectivity'

export interface NaverMapViewHandle {
  injectJavaScript: (js: string) => void
}

interface Props {
  html: string
  onMessage: (event: { nativeEvent: { data: string } }) => void
  /**
   * 지도 페이지가 준비됐을 때(처음, 그리고 다시 불러온 뒤마다). 다시 불러오면 페이지가
   * 새로 뜨면서 올려 둔 마커가 사라지므로, 호출부는 여기서 현재 상태를 다시 보내야 한다.
   */
  onReady?: () => void
}

/** 이 시간 안에 지도가 준비되지 않으면 다시 불러온다. 보통 3~5초 안에 뜬다. */
const READY_TIMEOUT_MS = 12_000
/** 자동으로 다시 불러오는 횟수. 넘으면 "다시 시도" 버튼을 띄우고 멈춘다(무한 재시도로 배터리·데이터를 쓰지 않게). */
const MAX_AUTO_RELOADS = 2
/**
 * WebView 프로세스가 죽어 다시 불러오는 횟수 상한(아래 시간 창 안에서). 준비 신호가 오면 위 자동 재시도
 * 횟수는 0 으로 돌아가서, 크래시는 따로 시간 기준으로 센다 — 안 그러면 "뜨자마자 죽음"이 끝없이 반복된다.
 */
const MAX_CRASH_RELOADS = 3
const CRASH_WINDOW_MS = 60_000
const READY_MESSAGE = '__hongikonMapReady'

/**
 * 페이지 안에서 지도가 실제로 만들어졌는지 확인해 알려 주는 스크립트. map.html 을 고치지 않아도
 * (이미 배포된 페이지 그대로) 동작하도록 페이지 전역(map, handleNativeMessage)만 보고 판단한다.
 * maps.js 로딩이 실패하면 `new naver.maps.Map` 에서 멈춰 둘 다 생기지 않는다.
 */
const READY_PROBE_JS = `
(function () {
  if (window.__hongikonReadyProbe) return;
  window.__hongikonReadyProbe = true;
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var ready = typeof window.handleNativeMessage === 'function' && window.map && window.naver && window.naver.maps;
    if (ready || tries > 60) {
      clearInterval(timer);
      if (ready && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: '${READY_MESSAGE}' }));
      }
    }
  }, 250);
})();
true;
`

/**
 * html prop은 안 쓴다(웹 빌드용 NaverMapView.web.tsx만 씀).
 * 인라인 HTML을 WKWebView에 넣으면 요청 origin이 비어 네이버 지도 도메인
 * 인증이 항상 실패해, 대신 실제 도메인(MAP_PAGE_URL)에서 원격으로 불러온다.
 *
 * 원격으로 불러오다 보니 첫 로딩이 가끔 실패해 지도가 빈 화면으로 남았다(앱을 다시 켜면 뜸).
 * 준비 신호가 제한 시간 안에 안 오거나, 로딩 오류·WebView 프로세스 종료가 나면 자동으로 다시 불러오고,
 * 그래도 안 되면 "다시 시도" 버튼을 보여 준다. 앱이 앞으로 돌아오거나 네트워크가 다시 연결될 때도 한 번 더 시도한다.
 */
const NaverMapView = forwardRef<NaverMapViewHandle, Props>(({ onMessage, onReady }, ref) => {
  const webViewRef = useRef<WebViewType>(null)
  const readyRef = useRef(false)
  const autoReloadsRef = useRef(0)
  const crashTimesRef = useRef<number[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    },
    [clearTimer],
  )

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
    [clearTimer, onMessage, onReady],
  )

  // 백그라운드에 있다 돌아왔는데 아직 지도가 없으면 한 번 더 시도한다.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !readyRef.current) reload(true)
    })
    return () => sub.remove()
  }, [reload])

  // 오프라인이었다가 연결되면 한 번 더 시도한다.
  useReconnect(() => {
    if (!readyRef.current) reload(true)
  })

  useEffect(() => clearTimer, [clearTimer])

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.container}
        source={{ uri: MAP_PAGE_URL }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onMessage={handleMessage}
        scrollEnabled={false}
        onLoadStart={handleLoadStart}
        injectedJavaScript={READY_PROBE_JS}
        onLoadEnd={() => webViewRef.current?.injectJavaScript(READY_PROBE_JS)}
        onError={() => reload(false)}
        onHttpError={() => reload(false)}
        // iOS 는 메모리 압박에, 안드로이드는 렌더러 크래시로 WebView 가 흰 화면이 될 수 있다.
        onContentProcessDidTerminate={handleCrash}
        onRenderProcessGone={handleCrash}
      />

      {failed && (
        <View style={styles.overlay}>
          <Text style={styles.title}>지도를 불러오지 못했어요</Text>
          <Text style={styles.body}>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              crashTimesRef.current = []
              reload(true)
            }}
            accessibilityRole="button"
            accessibilityLabel="지도 다시 불러오기"
          >
            <Text style={styles.buttonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}
      {!failed && reloading && (
        <View style={styles.reloading} pointerEvents="none">
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.reloadingText}>지도를 다시 불러오는 중…</Text>
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
  reloading: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
  },
  reloadingText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary },
})

export default NaverMapView
