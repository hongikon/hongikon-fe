import AsyncStorage from '@react-native-async-storage/async-storage'

export const STORAGE_KEY = '@hongik_partner_notice_seen'

/**
 * 안내를 이미 봤는지. 앱 전체가 함께 본다 — 알림 안내(NotificationPrimer)가 이 창이 닫힐 때까지 기다린다.
 * 처음 로그인하고 지도에 들어오면 이 창과 알림 안내(전체 화면 Modal)가 거의 동시에 떴는데, 네이티브 Modal 두 개가
 * 겹쳐 뜨면 뒤 것이 제대로 안 열리고 보이지 않는 막만 남아 화면을 눌러도 반응이 없었다(10-15 iOS·Android 첫 설치 제보).
 * 'unknown' = 저장소를 아직 안 읽음, 'pending' = 띄울 차례, 'seen' = 봤음(또는 못 읽어 건너뜀).
 */
export type NoticeState = 'unknown' | 'pending' | 'seen'

export let noticeState: NoticeState = 'unknown'

export let loading = false

export const listeners = new Set<() => void>()

export function setNoticeState(next: NoticeState): void {
  if (noticeState === next) return
  noticeState = next
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!loading) {
    loading = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((seen) => setNoticeState(seen ? 'seen' : 'pending'))
      .catch(() => setNoticeState('seen'))
  }
  return () => {
    listeners.delete(listener)
  }
}
