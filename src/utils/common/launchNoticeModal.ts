import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AppNotice } from '../../constants/appNotices'
import { loadAppNotices } from '../../lib/appNotices'
import { currentPopupNotice } from '../settings/noticeMerge'

/** '다시 보지 않기'를 누른 팝업 공지 id. 새 팝업 공지(id 가 다름)가 생기면 다시 뜬다. '닫기'는 남기지 않는다(다음 실행에 다시 뜬다). */
export const STORAGE_KEY = '@hongikon_launch_notice_seen'

/**
 * 띄울 차례인지. PartnerNoticeModal 과 같은 방식으로 앱 전체가 함께 본다 — 알림 안내(NotificationPrimer)가 이 창이
 * 닫힐 때까지 기다린다(네이티브 Modal 두 개가 겹치면 화면이 눌리지 않았다, PartnerNoticeModal 주석).
 * 'unknown' = 저장소를 아직 안 읽음, 'pending' = 띄울 차례, 'seen' = 봤음·띄울 공지 없음·못 읽어 건너뜀.
 */
export type LaunchNoticeState = 'unknown' | 'pending' | 'seen'

/** 서버 공지(11-09)를 받은 뒤 정한다 — 받기 전엔 'unknown' 이라 다른 첫 실행 안내도 기다린다(받기는 최대 4초). */
export let popupNotice: AppNotice | null = null

export let noticeState: LaunchNoticeState = 'unknown'

export let loading = false

export const listeners = new Set<() => void>()

export function setNoticeState(next: LaunchNoticeState): void {
  if (noticeState === next) return
  noticeState = next
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!loading) {
    loading = true
    loadAppNotices()
      .then(async (notices) => {
        const notice = currentPopupNotice(notices)
        if (!notice) return setNoticeState('seen')
        const seenId = await AsyncStorage.getItem(STORAGE_KEY)
        popupNotice = notice
        setNoticeState(seenId === notice.id ? 'seen' : 'pending')
      })
      .catch(() => setNoticeState('seen'))
  }
  return () => {
    listeners.delete(listener)
  }
}
