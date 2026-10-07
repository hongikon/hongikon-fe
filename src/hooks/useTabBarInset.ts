import { useContext } from 'react'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'

/**
 * 하단 탭 바(떠 있는 캡슐)는 모든 탭에서 화면 위에 겹쳐 뜬다(10-07 요청 — 내용이 바 뒤로 비쳐 보이게).
 * 그래서 스크롤 목록 끝이 바에 가리지 않게, 목록 맨 아래에 이 높이만큼 여백을 둔다. 탭 밖(모달·스택 상세)에서는 0.
 */
export function useTabBarInset(): number {
  return useContext(BottomTabBarHeightContext) ?? 0
}
