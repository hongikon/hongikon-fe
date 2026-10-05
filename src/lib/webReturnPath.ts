import { useEffect } from 'react'
import { Platform } from 'react-native'
import { getStateFromPath } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { useDeptPickPending, useOnboardingDone } from './onboarding'
import { navigationRef } from '../navigation/navigationRef'
import { WEB_LINKING } from '../navigation/linking'
import { peekAdminIntent, requestAdminIntent } from './adminIntents'

/**
 * 웹: 로그인 전에 연 주소(`/news/123`, `/news/dept/...`, `/map`, `/settings` …)로 로그인·둘러보기 뒤에 돌아가기.
 *
 * 로그인 전(signedOut) 스택에는 메인이 없어, 링크로 들어와도 웰컴부터 보이고 원래 주소는 잊혔다. 그래서 앱을 여는 순간
 * 주소를 적어 두었다가(`captureWebReturnPath`, `App.tsx` 모듈 로드 때) 로그인·둘러보기를 마치고 메인 스택이 뜨면 한 번
 * 그 주소로 옮긴다(`useWebReturnPath`). 첫 실행이라 학과 고르기가 남았으면 학과 고르기를 먼저 마치고(고르기·"나중에")
 * 메인이 뜬 뒤에 옮긴다 — 학과 고르기는 메인 대신 뜨는 한 번짜리 화면이고, 끝낸 뒤 원래 보려던 화면으로 가는 편이
 * 자연스럽다. 온보딩(소개)을 하는 중이어도 같다.
 *
 * sessionStorage 에 둔다 — 웹 카카오 로그인은 페이지 전체가 카카오로 갔다가 `/auth/callback` 으로 돌아오며 새로 로드돼
 * 모듈 변수는 사라지지만, 같은 탭의 sessionStorage 는 남는다. 탭을 닫으면 지워지고, 오래된 값(1시간)은 쓰지 않는다.
 * 이미 로그인·둘러보기 상태로 링크를 열었으면 linking 이 바로 그 화면을 열어, 지금 주소와 같으므로 지우기만 한다.
 *
 * 적지 않는 주소: `/`(처음부터 들어온 것 — 예전 값도 지운다), `/welcome`·`/onboarding*`(흐름 중 새로고침이라 예전 값을
 * 그대로 둔다), `/auth/callback`(로그인 복귀 — 그대로 둔다), `/admin*`·`/temp*`(앱 내비게이션을 거치지 않는다),
 * `/r/{id}` 공유 제보(지도 요청으로 따로 처리하고 지도가 첫 탭이라 돌아갈 곳이 따로 없다 — 예전 값은 지운다).
 * `/manage`(관리 탭)는 적어 두되, 돌아갈 때 화면을 바꾸지 않고 관리 탭 열기 요청(`adminIntents`)만 남긴다 — 관리 탭은 관리자
 * 확인(서버 응답) 뒤에야 하단 탭에 붙는다. 예전엔 적지 않아, 로그아웃 상태로 /manage 를 연 관리자가 카카오 로그인을 마치면 지도만 열렸다.
 * 옮기는 건 앱 안 화면 상태 바꾸기(resetRoot)뿐이라 다른 사이트로 보낼 수 없고, 앱이 모르는 주소면 버린다.
 */

const STORAGE_KEY = 'hongikon_return_path'
const MAX_AGE_MS = 60 * 60 * 1000
/** 로그인 전 흐름의 주소(온보딩·웰컴·학과 고르기). 적지 않는다. */
const FLOW_PATH = /^\/(welcome|onboarding)(\/|$)/
/** 관리 탭 주소. 화면 상태로 옮기지 않고 관리 탭 열기 요청으로 바꾼다. */
const MANAGE_PATH = /^\/manage\/?(\?|$)/

interface StoredReturnPath {
  path: string
  savedAt: number
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

function clear(): void {
  try {
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    // 지우지 못해도 다음 소비 때 지금 주소와 견주거나 만료로 걸러진다.
  }
}

/** 앱 시작 때 한 번(웹만). 위 규칙대로 지금 주소를 적거나, 지우거나, 그대로 둔다. */
export function captureWebReturnPath(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  if (pathname === '/' || /^\/r\//.test(pathname)) {
    clear()
    return
  }
  if (
    FLOW_PATH.test(pathname) ||
    pathname === '/auth/callback' ||
    /^\/(admin|temp)(\/|$)/.test(pathname)
  ) {
    return
  }
  const value: StoredReturnPath = { path: pathname + window.location.search, savedAt: Date.now() }
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 저장하지 못하면 예전처럼 메인 첫 화면에서 시작할 뿐이다.
  }
}

/** 적어 둔 주소를 꺼내고 지운다. 없거나, 형식이 틀리거나, 오래됐으면 null. */
function takeWebReturnPath(): string | null {
  const store = storage()
  if (!store) return null
  let raw: string | null = null
  try {
    raw = store.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  clear()
  try {
    const { path, savedAt } = JSON.parse(raw) as Partial<StoredReturnPath>
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null
    if (typeof savedAt !== 'number' || Date.now() - savedAt > MAX_AGE_MS) return null
    return path
  } catch {
    return null
  }
}

/**
 * 메인 스택이 뜨면(로그인·둘러보기, 온보딩·학과 고르기까지 끝남) 적어 둔 주소로 한 번 옮긴다. `NavigationContainer` 안에서
 * 한 번만 부른다(`App.tsx`). 상태가 바뀐 그 렌더에는 아직 이전 스택일 수 있어, 내비게이션 상태가 바뀔 때마다 다시 본다.
 */
export function useWebReturnPath(): void {
  const { status } = useAuth()
  const onboardingDone = useOnboardingDone() !== false
  const deptPickPending = useDeptPickPending()
  // 학과 고르기는 로그인한 사람에게만 뜬다(RootNavigator) — 게스트는 남은 표시가 있어도 바로 메인이다.
  const deptPickShown = deptPickPending && status === 'authenticated'
  const ready = Platform.OS === 'web' && (status === 'guest' || status === 'authenticated') && onboardingDone && !deptPickShown

  useEffect(() => {
    if (!ready) return
    const tryRestore = () => {
      if (!navigationRef.isReady() || !navigationRef.getRootState()?.routeNames.includes('Main')) return
      const path = takeWebReturnPath()
      if (!path || path === window.location.pathname + window.location.search) return
      if (MANAGE_PATH.test(path)) {
        // 이미 로그인한 채 /manage 로 들어왔으면 App.tsx 가 같은 요청을 남겨 두었다(아직 확인 중) — 겹쳐 두 번 안내하지 않는다.
        // 게스트면 AdminAccessProvider 가 조용히 버린다.
        if (!peekAdminIntent()) requestAdminIntent({ section: 'open' })
        return
      }
      // 링크로 바로 들어왔을 때와 같은 상태(메인을 아래에 깐 그 화면)로 바꾼다. 쌓지(push) 않고 바꾸므로(reset) linking 이
      // 지금 방문 기록(학과 고르기·웰컴 주소)을 원래 주소로 갈아 끼운다 — 브라우저 뒤로가기가 앱이 그릴 수 없는
      // `/onboarding/depts` 로 가지 않고, 앱 안 뒤로 버튼은 아래에 깐 메인으로 간다.
      const state = getStateFromPath(path, WEB_LINKING.config)
      if (!state) return // 앱이 모르는 주소(오래된 링크 등) — 메인 첫 화면에 그대로 둔다.
      navigationRef.resetRoot(state)
    }
    tryRestore()
    return navigationRef.addListener('state', tryRestore)
  }, [ready])
}
