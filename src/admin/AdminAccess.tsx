import { createContext, useContext, type ReactNode } from 'react'
import type { OverviewState } from './types'
import { useAdminAccessProvider } from './hooks/shell/useAdminAccessProvider'
import { type AdminAccessValue } from './utils/shell/adminAccess'

const AdminAccessContext = createContext<AdminAccessValue | null>(null)

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const { value } = useAdminAccessProvider()

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
}

function useAdminAccess(): AdminAccessValue {
  const ctx = useContext(AdminAccessContext)
  if (!ctx) throw new Error('useIsAdmin must be used within AdminAccessProvider')
  return ctx
}

/** 로그인한 계정이 관리자인지(서버에 물어 본 결과). 게스트·로그아웃이면 항상 false. */
export function useIsAdmin(): boolean {
  return useAdminAccess().isAdmin
}

/** 관리 탭 대시보드·배지가 쓰는 overview 와 다시 불러오기. */
export function useAdminOverview(): OverviewState {
  return useAdminAccess().overview
}
