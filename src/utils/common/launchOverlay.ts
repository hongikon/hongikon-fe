import AsyncStorage from '@react-native-async-storage/async-storage'
import { SETTINGS_STORAGE_KEY } from '../../lib/accountData'
import { restoreSettings, type StoredSettings } from '../settingsStorage'
import { prefetchNewsFirstPage } from '../../hooks/useNewsFeed'

/**
 * 지도 데이터가 이 시간 안에 준비되면(기기 저장본이 있는 두 번째 실행부터) 로딩 화면 없이 바로 걷는다 — 안내·막대는 이 시간이
 * 지나야 나타나므로 보이지 않고, 사용자에게는 스플래시 로고에서 곧장 앱으로 넘어간 것으로 보인다.
 * 처음 실행처럼 서버에서 받아야 하면 그때 안내·막대가 나타나 받을 때까지(최소 MIN, 최대 MAX) 찬다.
 */
export const CACHE_HIT_WITHIN_MS = 200

export const MIN_VISIBLE_MS = 400

/** 이보다 오래 기다리지 않는다. 지도 데이터가 늦으면 지도 화면이 자기 로딩·다시 시도를 보여 준다. */
export const MAX_VISIBLE_MS = 2500

/** 기기에 저장된 구독 게시판으로 소식 첫 페이지를 미리 받는다. 소식 탭을 열면 바로 보이게. 시작 화면은 이걸 기다리지 않는다. */
export function warmNews(): void {
  AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
    .then((raw) => {
      if (!raw) return
      const { subscribedDepts } = restoreSettings(JSON.parse(raw) as StoredSettings).settings
      if (subscribedDepts.length > 0) return prefetchNewsFirstPage(subscribedDepts)
    })
    .catch(() => {})
}
