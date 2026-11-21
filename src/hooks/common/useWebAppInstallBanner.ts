import { useState } from 'react'
import { pickStore, dismissedNow } from '../../utils/common/webAppInstallBanner'

/** WebAppInstallBanner 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useWebAppInstallBanner() {
  const [store] = useState(pickStore)
  const [hidden, setHidden] = useState(() => store === null || dismissedNow())
  return { store, hidden, setHidden }
}
