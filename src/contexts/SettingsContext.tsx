import { createContext, useContext, type ReactNode } from 'react'
import type { CategoryKey } from '../constants/colors'
import { type Settings } from '../utils/settings/storage'
import { useSettingsProvider } from '../hooks/settings/useSettingsProvider'

export { ALL_CATEGORIES } from '../utils/settings/storage'

interface SettingsContextValue {
  settings: Settings
  toggleSubscriptionAlert: () => void
  toggleAlertCategory: (cat: CategoryKey) => void
  toggleSubscribedDept: (id: string) => void
  /** 구독 중인 게시판의 알림만 켜고 끈다. 구독하지 않은 게시판이면 아무 일도 하지 않는다. */
  toggleDeptAlert: (id: string) => void
  isDeptAlertOn: (id: string) => boolean
  /** 내 제보 결과(승인·반려) 알림 켜고 끄기. */
  toggleReportStatusAlert: () => void
  /** 캠퍼스 새 제보 알림 켜고 끄기. */
  toggleNewReportAlert: () => void
  toggleBookmark: (id: string) => void
  isBookmarked: (id: string) => boolean
  resetSettings: () => void
  /**
   * 구독 목록을 믿고 볼 수 있는지. 게스트는 늘 true, 로그인 상태면 로그인 뒤 서버 구독과 한 번 합쳐 본 뒤에 true
   * (실패·서버 API 없음도 끝난 것으로 본다 — 그때는 로컬 값이 전부다). 학과 고르기(`DeptPickScreen`)가
   * "이 계정에 이미 구독이 있으면 건너뛰기"를 판단할 때 쓴다.
   */
  boardSubscriptionsReady: boolean
  /**
   * '구독 소식 알림' 스위치(`subscriptionAlert`)를 믿고 볼 수 있는지. 게스트는 늘 true, 로그인 상태면 이 계정의 마지막 값을
   * 되살린 뒤에 true. 그 전의 값은 게스트 기본값(켜짐)이라, 푸시 기기 등록(`usePushNotifications`)이 이걸 기다린다 —
   * 꺼 둔 계정이 로그인하자마자 한 번 등록됐다 내려가지 않게.
   */
  pushPrefReady: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { loaded, value } = useSettingsProvider()

  if (!loaded) return null

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

/** 설정 공급자 밖에서도 그려지는 화면용(웹 /dev/ask 미리보기 — 물어보기 설정 카드는 공급자가 없으면 꺼진다). */
export function useOptionalSettings(): SettingsContextValue | null {
  return useContext(SettingsContext)
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
