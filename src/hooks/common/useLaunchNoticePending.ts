import { useSyncExternalStore } from 'react'
import { subscribe, noticeState } from '../../utils/common/launchNoticeModal'

/** 앱 공지 팝업이 아직 닫히지 않았는지(판단 전 포함). 다른 첫 실행 안내 창은 이게 false 가 된 뒤에 띄운다. */
export function useLaunchNoticePending(): boolean {
  return useSyncExternalStore(subscribe, () => noticeState, () => noticeState) !== 'seen'
}
