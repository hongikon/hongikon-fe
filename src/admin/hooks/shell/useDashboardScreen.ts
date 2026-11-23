import { useEffect, useState } from 'react'
import type { AdminSection, OverviewState } from '../../types'

/** DashboardScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDashboardScreen({ overview }: Pick<{
  overview: OverviewState
  onNavigate: (section: AdminSection) => void
}, 'overview'>) {
  const { data, loading, error, updatedAt, refresh } = overview
  // 상대 시각(“3분 전”)이 멈춰 보이지 않게 30초마다 다시 그린다.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  // 새 수치를 받은 순간 기준 시각도 맞춘다(안 그러면 방금 받은 값이 "곧"으로 보인다).
  useEffect(() => {
    if (updatedAt) setNow(Date.now())
  }, [updatedAt])
  return { data, loading, error, updatedAt, refresh, now }
}
