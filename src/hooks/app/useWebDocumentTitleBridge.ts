import { useEffect } from 'react'
import { navigationRef } from '../../navigation/navigationRef'
import { formatDocumentTitle } from '../../navigation/linking'

/** WebDocumentTitleBridge 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useWebDocumentTitleBridge() {
  useEffect(
    () =>
      navigationRef.addListener('state', () => {
        const route = navigationRef.getCurrentRoute()
        document.title = formatDocumentTitle(route?.name, route?.params)
      }),
    [],
  )
}
