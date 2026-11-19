import { createContext, useContext } from 'react'

/**
 * 관리자 화면이 어디에 그려지는지.
 * - 'console': 웹 `/admin` 콘솔(데스크톱 위주, 기존 모양 그대로)
 * - 'app': 앱 하단 "관리" 탭(폰 너비). 누르는 것은 앱 공용 버튼(높이 44)으로, 되돌리기 어려운 처리는
 *   `utils/dialog.ts` 의 확인 창으로 묻는다.
 */
export type AdminHost = 'console' | 'app'

const AdminHostContext = createContext<AdminHost>('console')

export const AdminHostProvider = AdminHostContext.Provider

export function useAdminHost(): AdminHost {
  return useContext(AdminHostContext)
}

/**
 * 앱 관리 탭의 세로 스크롤을 안쪽 부품이 움직일 수 있게 한다(AdminTabScreen 이 넣는다, 웹 콘솔은 없음).
 * ScrollView 의 automaticallyAdjustKeyboardInsets 는 포커스된 입력칸의 윗부분만 키보드 위로 올려서,
 * 그 아래 확인 버튼(반려·이용 정지)이 키보드에 가린다. ConfirmBar 가 이걸로 자기 전체를 키보드 위로 올린다.
 */
export interface AdminScrollHandle {
  /** 지금 위치에서 dy 만큼 아래로(양수) 스크롤한다. */
  scrollBy: (dy: number) => void
}

/** useRevealAboveKeyboard 가 읽는다. 화면에서는 AdminScrollProvider 로 넣는다. */
export const AdminScrollContext = createContext<AdminScrollHandle | null>(null)

export const AdminScrollProvider = AdminScrollContext.Provider
