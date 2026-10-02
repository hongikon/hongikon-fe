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

export type FlagReason = 'FALSE_INFO' | 'SPAM' | 'INAPPROPRIATE' | 'PRIVACY' | 'ETC'

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
  /** 사진 보기 URL 들(최대 3장, 등록 순서). 여러 장 기능 전 서버는 없다 — `reportImageUrls` 로 읽는다. */
  imageUrls?: string[]
  buildingId: number | null
  buildingName: string | null
  floor: number | null
  lat: number | null
  lng: number | null
  startsAt: string
  endsAt: string
  createdAt: string
  authorId: number | null
  /** 로그인(카카오/Apple) 닉네임 원문. 검토용이라 관리자 화면에만 온다. */
  authorNickname: string | null
  /** 앱 사용자에게 보이는 이름(앱 닉네임 또는 가린 이름). 앱 닉네임 기능 전 서버는 없음. */
  authorDisplayName?: string | null
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

export type UserStatus = 'ACTIVE' | 'SUSPENDED'

/** `GET /admin/users` 한 줄(백엔드 `AdminUserResponse`). 연락처는 오지 않는다. */
export interface AdminUser {
  id: number
  /** 공개 회원 번호(영문 대문자·숫자 10자리, 예: K7Q2M9XA4D). 회원 번호를 내려 주기 전 서버면 없다 — 그때는 #id 를 보여 준다. */
  memberCode?: string | null
  /** 로그인(카카오/Apple) 닉네임 원문 */
  nickname: string
  socialType: 'KAKAO' | 'GOOGLE' | 'APPLE' | string
  role: 'USER' | 'ADMIN' | string
  status: UserStatus
  suspendedReason: string | null
  suspendedAt: string | null
  createdAt: string
}

export type AdminSection = 'dashboard' | 'reports' | 'users' | 'feedback' | 'tools'

/** 대시보드 수치와 그 요청 상태. 웹 콘솔은 AdminApp, 앱 관리 탭은 AdminAccessProvider 가 들고 있다. */
export interface OverviewState {
  data: AdminOverview | null
  loading: boolean
  error: string | null
  /** 마지막으로 성공한 시각(ms) */
  updatedAt: number | null
  refresh: () => void
}
