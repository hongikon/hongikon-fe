import { getPathFromState, type LinkingOptions } from '@react-navigation/native'
import type { RootStackParamList } from './RootNavigator'

/**
 * 웹 주소 ↔ 화면 연결. 탭·소식 화면마다 주소(`/map`, `/news`, `/news/{id}` …)가 생겨 링크로 공유할 수 있고,
 * 화면 이동이 브라우저 방문 기록에 쌓여 뒤로가기가 사이트를 나가지 않고 이전 화면으로 돌아간다.
 *
 * 웹에서만 켠다(`App.tsx`). 네이티브는 카카오 로그인 복귀(`hongikon://auth/callback`)·푸시 알림 이동이
 * 따로 URL 을 다루고 있어, 딥링크까지 열려면 그쪽과 함께 따로 확인한다.
 *
 * 탭은 한 번 연 화면을 살려 둔 채 가리기만 하므로, 주소가 바뀌어도 지도를 다시 불러오지 않는다.
 * `/admin`·`/temp/*`·`/auth/callback` 은 `App.tsx`·`AuthContext` 가 내비게이션보다 먼저 처리한다 —
 * 그래서 관리 탭 주소는 `/admin` 이 아니라 `/manage` 다.
 */
export const WEB_LINKING: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://hongikon.com'],
  config: {
    // 링크로 상세·학과 소식에 바로 들어와도 그 아래에 탭·소식 목록을 깔아, 앱 안 뒤로 버튼이 갈 곳이 있게 한다.
    initialRouteName: 'Main',
    screens: {
      Main: {
        screens: {
          Map: 'map',
          News: {
            path: 'news',
            screens: {
              NewsHome: '',
              // 학과 이름은 주소에 ?deptName= 로 붙는다(제목 표시용).
              DeptNews: 'dept/:deptId',
            },
          },
          Settings: 'settings',
          Admin: 'manage',
        },
      },
      NewsSearch: 'news/search',
      NewsDetail: 'news/:newsId',
      AppStatus: 'app-status',
      Welcome: 'welcome',
      Onboarding: 'onboarding',
    },
  },
  // 목록에서 연 상세는 소식 요약 객체(item)를 들고 있다. 그대로 두면 주소에 객체가 실리므로
  // 공유할 수 있는 `/news/{id}` 로 바꿔 적는다. 그 주소로 들어오면 상세 화면이 id 로 본문을 받는다.
  getPathFromState: (state, options) => getPathFromState(withNewsIdParams(state), options),
}

type LinkState = Parameters<typeof getPathFromState>[0]

function withNewsIdParams(state: LinkState): LinkState {
  return {
    ...state,
    routes: state.routes.map((route) => {
      const params = route.params as { item?: { id: string } } | undefined
      const next = route.name === 'NewsDetail' && params?.item ? { ...route, params: { newsId: params.item.id } } : route
      return next.state ? { ...next, state: withNewsIdParams(next.state as LinkState) } : next
    }),
  } as LinkState
}

const TITLES: Record<string, string> = {
  Map: '지도',
  NewsHome: '소식',
  DeptNews: '학과 소식',
  NewsDetail: '소식',
  NewsSearch: '소식 검색',
  Settings: '설정',
  Admin: '관리',
  AppStatus: '앱 상태',
}

/** 브라우저 탭 제목. 정적 안내 페이지(`scripts/static-pages.mjs`)와 같은 "화면 | 홍익온" 형식. */
export function formatDocumentTitle(routeName: string | undefined, params: unknown): string {
  const deptName = routeName === 'DeptNews' ? (params as { deptName?: string } | undefined)?.deptName : undefined
  const title = deptName ?? (routeName ? TITLES[routeName] : undefined)
  return title ? `${title} | 홍익온` : '홍익온'
}
