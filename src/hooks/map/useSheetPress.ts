import { createContext, useCallback, useContext } from 'react'

/**
 * 본문 안 줄(행정·지원 부서, 건물 안 시설 등)을 누를 때 쓴다. 스크롤하려고 끈 손동작이 줄 누르기로 먹어 엉뚱하게 들어가던 것(10-27)을 막는다.
 * 시트 스크롤은 시트 끌기로 넘기려고 JS 응답자를 맡지 않아(disableScrollViewPanResponder), 스크롤해도 줄의 누르기가 취소되지 않는다.
 */
export const SheetPressGuardContext = createContext<() => boolean>(() => false)

/** `guard(fn)` 은 방금 스크롤한 손동작이면 fn 을 부르지 않는다. */
export function useSheetPress() {
  const scrolled = useContext(SheetPressGuardContext)
  return useCallback(
    (fn: () => void) => () => {
      if (scrolled()) return
      fn()
    },
    [scrolled],
  )
}
