import type { ReportCategory } from '../types'

/**
 * 관리자 API 응답 타입. 계약은 백엔드 `feat/admin-console` 의 관리자 API 스펙을 따른다.
 * 날짜는 존 정보 없는 LocalDateTime 문자열(`2026-09-30T12:34:56`)이다 — `format.ts` 의
 * `parseServerDate` 로만 해석한다.
 */

export type ReportStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'HIDDEN' | 'DELETED'
/** 목록 조회 필터. `ALL` 은 DELETED 를 뺀 전부. */
export type ReportStatusFilter = Exclude<ReportStatus, 'DELETED'> | 'ALL'
/** PATCH 로 바꿀 수 있는 목표 상태. PENDING 으로 되돌리는 건 허용되지 않는다. */
export type ReportTargetStatus = Exclude<ReportStatus, 'PENDING'>

export type FlagReason = 'FALSE_INFO' | 'SPAM' | 'INAPPROPRIATE' | 'ETC'

export type FeedbackStatus = 'OPEN' | 'RESOLVED'
export type FeedbackStatusFilter = FeedbackStatus | 'ALL'

export type CrawlerTrigger = 'SCHEDULED' | 'MANUAL'

export interface AdminOverview {
  server: { version: string | null; buildTime: string | null }
  reports: { pending: number; active: number; hidden: number; rejected: number }
  feedback: { open: number }
  news: { total: number; missingDepartment: number }
  /** 서버 메모리에만 있어 재시작 후 첫 실행 전까지 각 필드가 null 이다. */
  crawler: {
    running: boolean
    lastStartedAt: string | null
    lastFinishedAt: string | null
    lastSavedCount: number | null
    lastError: string | null
    lastTrigger: CrawlerTrigger | null
  }
}

export interface AdminReport {
  id: number
  status: ReportStatus
  category: ReportCategory
  customCategoryLabel: string | null
  title: string
  content: string | null
  /** 첨부 사진 보기 URL(presigned GET, 약 1시간). 사진이 없거나 반려·삭제로 지워졌으면 null. 이전 서버는 필드 자체가 없다. */
  imageUrl?: string | null
  buildingId: number | null
  buildingName: string | null
  floor: number | null
  lat: number | null
  lng: number | null
  startsAt: string
  endsAt: string
  createdAt: string
  authorId: number | null
  authorNickname: string | null
  flagCount: number
  moderationNote: string | null
  reviewedAt: string | null
}

export interface AdminReportFlag {
  id: number
  reason: FlagReason
  reporterNickname: string | null
  createdAt: string
}

export interface AdminFeedback {
  id: number
  content: string
  contact: string | null
  userId: number | null
  userNickname: string | null
  status: FeedbackStatus
  createdAt: string
  resolvedAt: string | null
}

export type AdminSection = 'dashboard' | 'reports' | 'feedback' | 'tools'
