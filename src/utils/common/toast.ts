import { createContext } from 'react'
import { navigationRef } from '../../navigation/navigationRef'

/**
 * 화면 아래에 잠깐 떴다 사라지는 안내(토스트). "구독했어요", "북마크에서 뺐어요"처럼
 * 방금 한 일이 반영됐다는 걸 가볍게 알려줄 때 쓴다. 오류 안내(RetryableError, Alert)는 대신하지 않는다.
 *
 * - 한 번에 하나만 보인다. 새 토스트가 오면 이전 것을 바로 바꾼다.
 * - 기본 2.2초 뒤 사라지고, 되돌리기 같은 버튼이 있으면 누를 시간을 조금 더 준다.
 * - 스크린리더: 뜰 때 문구를 읽어 준다(iOS announce, Android/웹 live region).
 *
 * 네이티브 Modal 은 앱 화면 위에 따로 뜬 창이라 루트에 그린 토스트가 그 아래에 가려진다.
 * 그래서 Modal 안에서 토스트를 띄우려면 그 Modal 안에 `<ToastViewport />` 를 하나 둔다.
 * 마지막에 붙은(가장 위에 있는) 뷰포트 한 곳에만 그려진다.
 */

export type ToastTone = 'success' | 'info' | 'warning'

export interface ToastOptions {
  message: string
  tone?: ToastTone
  /** 오른쪽에 붙는 버튼(예: 되돌리기). 누르면 토스트도 닫힌다. */
  action?: { label: string; onPress: () => void }
  /** ms. 기본 2200, 버튼이 있으면 3500. */
  duration?: number
}

export interface ActiveToast extends ToastOptions {
  key: number
}

export interface ToastApi {
  show: (options: ToastOptions | string) => void
  hide: () => void
}

export interface ToastInternal extends ToastApi {
  toast: ActiveToast | null
  activeHost: number | null
  registerHost: (id: number, isRoot: boolean) => () => void
}

export const ToastContext = createContext<ToastInternal | null>(null)

export const DEFAULT_DURATION = 2200

export const ACTION_DURATION = 3500

/** 지금 맨 위 화면이 탭 화면(Main)인지. 내비게이션 상태가 바뀔 때마다 다시 잰다. */
export function isOnTabScreen(): boolean {
  if (!navigationRef.isReady()) return false
  const state = navigationRef.getRootState()
  return state?.routes[state.index]?.name === 'Main'
}

let nextHostId = 1

/** 토스트 뷰포트마다 겹치지 않는 번호를 준다. */
export function allocateHostId(): number {
  return nextHostId++
}
