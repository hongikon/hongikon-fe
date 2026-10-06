import { Suspense, useEffect } from 'react'
import { Platform } from 'react-native'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SettingsProvider } from './src/contexts/SettingsContext'
import { AuthProvider } from './src/contexts/AuthContext'
import RootNavigator from './src/navigation/RootNavigator'
import { navigationRef } from './src/navigation/navigationRef'
import { WEB_LINKING, formatDocumentTitle } from './src/navigation/linking'
import { usePushNotifications } from './src/lib/pushNotifications'
import NetworkStatusBanner from './src/components/common/NetworkStatusBanner'
import UpdateBanner from './src/components/common/UpdateBanner'
import NotificationPrimer from './src/components/common/NotificationPrimer'
import OnboardingGate from './src/components/onboarding/OnboardingGate'
import ErrorBoundary from './src/components/common/ErrorBoundary'
import { ToastProvider } from './src/components/common/Toast'
import { TempEntranceDebugEntry, TempNotificationPreviewEntry } from './src/debug/TempDebugEntry'
import { SHOW_DEVELOPER_TOOLS } from './src/lib/appVariant'
import { FONT_ASSETS } from './src/constants/typography'
import AdminEntry from './src/admin/AdminEntry'
import { AdminAccessProvider } from './src/admin/AdminAccess'
import { requestMapIntent } from './src/lib/mapIntents'
import { captureWebReturnPath, useWebReturnPath } from './src/lib/webReturnPath'
import { requestAdminIntent } from './src/lib/adminIntents'
import { initMapData } from './src/lib/mapData'

/** usePushNotifications는 useAuth를 쓰므로 AuthProvider 안, 리스너 등록은
 * NavigationContainer 안(navigationRef가 준비된 뒤)이어야 해서 별도 컴포넌트로 뺐다. */
function PushNotificationsBridge() {
  usePushNotifications()
  return null
}

/** 웹: 로그인 전에 연 주소로 로그인·둘러보기 뒤 돌아간다(`src/lib/webReturnPath.ts`). navigationRef·linking 을 쓰므로 NavigationContainer 안. */
function WebReturnPathBridge() {
  useWebReturnPath()
  return null
}

/**
 * 웹: 브라우저 탭 제목을 화면 상태가 바뀔 때마다 다시 맞춘다. NavigationContainer 의 documentTitle 은 화면 옵션('options')
 * 이벤트에서만 제목을 다시 쓰는데, 로그인·둘러보기로 스택이 통째로 바뀔 때는 그 이벤트가 바뀌기 전 경로(웰컴)로 불려
 * 지도·설정 등으로 넘어가도 제목이 "홍익온"에 머물렀다(헤드리스 크롬으로 확인). 제목은 경로 이름·params 로만 정하므로
 * 상태('state')가 바뀔 때 같은 formatter 로 덮어쓴다. 상태 이벤트는 그 커밋의 자식 effect(옵션 이벤트)보다 뒤에 온다.
 */
function WebDocumentTitleBridge() {
  useEffect(
    () =>
      navigationRef.addListener('state', () => {
        const route = navigationRef.getCurrentRoute()
        document.title = formatDocumentTitle(route?.name, route?.params)
      }),
    [],
  )
  return null
}

/**
 * 임시 - 출입구/실내 경로 검증용 웹 전용 경로. 로그인 상태와 무관하게 바로 보여야 해서
 * RootNavigator/NavigationContainer 를 아예 거치지 않고 여기서 분기한다.
 * `/temp/dots` = 지점+연결선+경로 전부, `/temp/path` = 경로 선만,
 * `/temp/path-nodes` = 실외 보행 경로망 전체.
 * 건물 데이터(서버)·pathNodes.ts 에 실 데이터가 반영되면 이 블록과
 * `src/screens/TempEntranceDebugScreen.tsx` 를 통째로 지운다.
 *
 * `/temp/notifications` = 알림 카드 미리보기(`TempNotificationPreviewScreen`).
 * `hongikon-be`에 발송부가 생겨 실제 원격 푸시로 확인할 수 있게 되면 지운다.
 *
 * 운영 웹(hongikon.com)에서는 열리지 않는다 — 개발 서버나 개발·테스트 빌드에서만 분기한다
 * (`SHOW_DEVELOPER_TOOLS`). 화면 코드는 `TempDebugEntry.web.tsx` 가 지연 로드한다.
 */
type TempDebugMode = 'dots' | 'paths' | 'nodes' | 'notifications'

const tempDebugMode: TempDebugMode | null =
  SHOW_DEVELOPER_TOOLS && Platform.OS === 'web' && typeof window !== 'undefined'
    ? (() => {
        const path = window.location.pathname.replace(/\/+$/, '')
        if (path === '/temp/dots') return 'dots'
        if (path === '/temp/path') return 'paths'
        if (path === '/temp/path-nodes') return 'nodes'
        if (path === '/temp/notifications') return 'notifications'
        return null
      })()
    : null

/**
 * 웹 관리자 콘솔(`/admin`, `/admin/...`). 앱의 로그인(AuthProvider)·내비게이션과 완전히 따로 돈다 —
 * 토큰도 별도(sessionStorage)다. `AdminEntry` 는 네이티브에선 null, 웹에선 지연 로드다.
 * 앱 안(네이티브·웹 앱)에서는 관리자 계정이면 하단 "관리" 탭으로 같은 화면들을 쓴다(`AdminAccess`, `AdminTabScreen`).
 */
const isAdminPath =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  /^\/admin(\/|$)/.test(window.location.pathname)

/**
 * 공유 링크 `https://hongikon.com/r/{id}`(제보 시트의 "공유"). Netlify 의 SPA 대체 규칙이 index.html 을 돌려주고,
 * 여기서 지도에 "그 제보 띄우기" 요청을 남긴 뒤 주소를 `/` 로 바꾼다(새로고침해도 다시 열리지 않게).
 * 지도 탭이 포커스될 때 요청을 꺼내 제보 레이어를 켜고 시트를 연다. 끝났거나 내려간 제보면 안내만 띄운다.
 */
export function sharedReportIdFromPath(pathname: string): number | null {
  const m = /^\/r\/(\d{1,12})\/?$/.exec(pathname)
  if (!m) return null
  const id = Number(m[1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // 아래 공유 링크 처리가 주소를 `/` 로 바꾸기 전에, 처음 연 주소부터 적어 둔다.
  captureWebReturnPath()
  // 관리 탭(`/manage`)은 관리자 확인(서버 응답) 뒤에야 하단 탭에 붙어, 새로고침하면 linking 이 그 탭을 못 찾고 지도로 열었다.
  // 관리 탭 열기 요청을 남겨 두면 AdminAccessProvider 가 확인이 끝난 뒤 관리 탭으로 옮긴다(관리자 알림 탭과 같은 길).
  if (/^\/manage\/?$/.test(window.location.pathname)) requestAdminIntent({ section: 'open' })
  const sharedId = sharedReportIdFromPath(window.location.pathname)
  if (sharedId !== null) {
    requestMapIntent({ type: 'focusReport', reportId: sharedId })
    try {
      window.history.replaceState(null, '', '/')
    } catch {
      // 주소를 못 바꿔도 제보는 연다.
    }
  }
}

// 지도 데이터(건물·편의시설·제휴업체)는 첫 탭인 지도가 바로 쓰므로 폰트·로그인 복원을 기다리지 않고 지금 받기 시작한다.
// 기기 저장본이 있으면 그것부터 내놓는다(`src/lib/mapData.ts`). 웹 관리자 콘솔은 지도를 그리지 않아 받지 않는다.
if (!isAdminPath) initMapData()

// 폰트가 준비될 때까지 스플래시를 띄워 둔다. 그렇게 하지 않으면
// 시스템 폰트로 한 프레임 그려졌다가 Pretendard 로 바뀌며 글자가 튄다.
SplashScreen.preventAutoHideAsync()

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS)

  useEffect(() => {
    // 폰트 로드에 실패해도 스플래시는 내린다. 시스템 폰트로라도 앱은 써야 한다.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return null
  }

  if (isAdminPath && AdminEntry) {
    return (
      <Suspense fallback={null}>
        <AdminEntry />
      </Suspense>
    )
  }

  if (tempDebugMode === 'notifications' && TempNotificationPreviewEntry) {
    return (
      <Suspense fallback={null}>
        <TempNotificationPreviewEntry />
      </Suspense>
    )
  }

  if (tempDebugMode && tempDebugMode !== 'notifications' && TempEntranceDebugEntry) {
    return (
      <Suspense fallback={null}>
        <TempEntranceDebugEntry mode={tempDebugMode} />
      </Suspense>
    )
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider><ToastProvider>
        <AuthProvider>
          {/* 관리자 여부(관리 탭)는 앱 로그인 토큰으로 서버에 물어 본다. 토스트를 쓰므로 ToastProvider 안. */}
          <AdminAccessProvider>
          {/* 온보딩을 보여줄지 정한 뒤에 설정을 불러온다(순서가 중요 — OnboardingGate 주석). */}
          <OnboardingGate>
          <SettingsProvider>
            {/* 웹만 화면마다 주소를 붙이고 브라우저 방문 기록과 잇는다(`src/navigation/linking.ts`). */}
            <NavigationContainer
              ref={navigationRef}
              linking={Platform.OS === 'web' ? WEB_LINKING : undefined}
              documentTitle={{ formatter: (_options, route) => formatDocumentTitle(route?.name, route?.params) }}
            >
              <PushNotificationsBridge />
              {Platform.OS === 'web' && <WebReturnPathBridge />}
              {Platform.OS === 'web' && <WebDocumentTitleBridge />}
              <RootNavigator />
              {/* 모든 화면 위에 떠야 해서 내비게이터 뒤(위 레이어)에 둔다. 네이티브 Modal 위로는 못 올라간다. */}
              <NetworkStatusBanner />
              <UpdateBanner />
              <NotificationPrimer />
              <StatusBar style="dark" />
            </NavigationContainer>
          </SettingsProvider>
          </OnboardingGate>
          </AdminAccessProvider>
        </AuthProvider>
      </ToastProvider></SafeAreaProvider>
    </ErrorBoundary>
  )
}
