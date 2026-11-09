import { useSyncExternalStore } from 'react'
import { APP_NOTICES, type AppNotice } from '../constants/appNotices'
import { getServerNotices } from '../apis/notices'
import { fromServerNotice, mergeNotices } from '../utils/noticeMerge'

/**
 * 앱 공지 = 앱에 적힌 공지(constants/appNotices.ts) + 관리자 페이지에서 쓴 서버 공지(GET /notices, 11-09).
 * 서버 공지는 게시 시각이 지난 것만 오므로 예약 공지는 그 시각 뒤에 앱을 켜야 보인다.
 * 앱을 켤 때 한 번 받는다. 못 받으면(오프라인·서버 오류·느림) 앱에 적힌 공지만 쓴다.
 */

/** 앱 첫 화면의 공지 팝업이 이 결과를 기다리므로 오래 붙잡지 않는다. */
const FETCH_TIMEOUT_MS = 4000

let notices: AppNotice[] = APP_NOTICES
let loading: Promise<AppNotice[]> | null = null
const listeners = new Set<() => void>()

/** 서버 공지를 한 번 받아 섞는다(앱 실행마다 한 번). 실패해도 거부하지 않고 앱에 적힌 공지를 준다. */
export function loadAppNotices(): Promise<AppNotice[]> {
  if (!loading) {
    loading = getServerNotices({ timeoutMs: FETCH_TIMEOUT_MS })
      .then((list) => {
        const server = list.map(fromServerNotice).filter((n): n is AppNotice => n !== null)
        notices = mergeNotices(APP_NOTICES, server)
        listeners.forEach((listener) => listener())
        return notices
      })
      .catch(() => notices)
  }
  return loading
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  void loadAppNotices()
  return () => {
    listeners.delete(listener)
  }
}

/** 설정 > 공지사항 목록. 처음엔 앱에 적힌 공지, 서버 공지를 받으면 섞어서 다시 그린다. */
export function useAppNotices(): AppNotice[] {
  return useSyncExternalStore(subscribe, () => notices, () => notices)
}
