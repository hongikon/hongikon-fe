import type { AdminOverview, AdminSection } from '../types'

/**
 * 웹 콘솔(AdminApp)의 섹션 ↔ 주소 경로와 메뉴 배지 숫자(순수 함수).
 */

export const SECTION_PATHS: Record<AdminSection, string> = {
  dashboard: '/admin',
  reports: '/admin/reports',
  comments: '/admin/comments',
  users: '/admin/users',
  feedback: '/admin/feedback',
  askFeedback: '/admin/ask-feedback',
  partners: '/admin/partners',
  facilities: '/admin/facilities',
  exhibitions: '/admin/exhibitions',
  notices: '/admin/notices',
  tools: '/admin/tools',
}

/** 주소 경로 → 섹션. 끝의 '/' 는 무시하고, 모르는 경로는 대시보드. */
export function sectionFromPath(pathname: string): AdminSection {
  const path = pathname.replace(/\/+$/, '')
  const match = (Object.keys(SECTION_PATHS) as AdminSection[]).find((key) => SECTION_PATHS[key] === path)
  return match ?? 'dashboard'
}

/** 메뉴 옆 빨간 숫자: 승인 대기 제보·미처리 문의·검토 대기 신고 댓글. */
export function navBadgeCount(overview: AdminOverview | null, item: AdminSection): number {
  if (!overview) return 0
  if (item === 'reports') return overview.reports.pending
  if (item === 'feedback') return overview.feedback.open
  if (item === 'comments') return overview.comments?.flaggedPending ?? 0
  return 0
}

/** 배지 글자(100 이상은 '99+'). */
export function navBadgeText(count: number): string | number {
  return count > 99 ? '99+' : count
}
