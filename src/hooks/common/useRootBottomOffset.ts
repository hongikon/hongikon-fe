import { useEffect, useState } from 'react'
import { navigationRef } from '../../navigation/navigationRef'
import { isOnTabScreen } from '../../utils/common/toast'

/** 탭 화면에서는 하단 탭바(TabNavigator, height 82) 위로 띄운다. */
export const ROOT_BOTTOM_OFFSET = 82 + 12

/** 탭바가 없는 화면(소식 상세·검색·학과 소식 등 스택 화면, 웰컴)에서는 홈 인디케이터 바로 위에 둔다. */
export const ROOT_BOTTOM_OFFSET_NO_TAB_BAR = 16

/**
 * 렌더할 때마다 지금 화면을 본다(토스트가 뜰 때마다 Provider 가 다시 그려 준다). 토스트가 떠 있는 사이
 * 화면을 옮겨도 따라가도록 내비게이션 상태 변화에도 다시 그린다.
 */
export function useRootBottomOffset(): number {
  const [, rerender] = useState(0)
  useEffect(() => navigationRef.addListener('state', () => rerender((n) => n + 1)), [])
  return isOnTabScreen() ? ROOT_BOTTOM_OFFSET : ROOT_BOTTOM_OFFSET_NO_TAB_BAR
}
