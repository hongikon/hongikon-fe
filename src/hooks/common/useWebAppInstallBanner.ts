import { useState } from 'react'
import { pickStore, dismissedNow } from '../../utils/common/webAppInstallBanner'
import { DISMISS_KEY } from '../../utils/common/webAppInstallBanner'
import { DISMISS_DAYS } from '../../utils/common/webAppInstallBanner'

/** WebAppInstallBanner 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useWebAppInstallBanner() {
  const [store] = useState(pickStore)
  const [hidden, setHidden] = useState(() => store === null || dismissedNow())

  const dismiss = () => {
    setHidden(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000))
    } catch {
      // 저장소를 못 쓰면(사생활 보호 모드 등) 이번 방문 동안만 숨긴다.
    }
  }
  return { store, hidden, setHidden, dismiss }
}
