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
  /** 검토할 신고된 댓글 수(마지막 검토 뒤 신고가 들어온 공개·자동 숨김 댓글). 이 기능 전 서버는 필드가 없다. */
  comments?: { flaggedPending: number }
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
  /**
   * 화면에 쓰지 않는다. 예전 서버는 로그인(카카오/Apple) 닉네임 원문을, 새 서버는 authorDisplayName 과 같은 값을 보낸다
   * (개인정보 최소 처리 — 원문은 회원 카드의 "로그인 닉네임 보기"로만).
   */
  authorNickname?: string | null
  /** 앱 사용자에게 보이는 이름(앱 닉네임 또는 가린 이름 "홍**"). 앱 닉네임 기능 전 서버는 없음. */
  authorDisplayName?: string | null
  /** 작성자 공개 회원 번호(K7Q2M9XA4D). 로그인 닉네임 가리기 전 서버는 없다 — 그때는 #id. */
  authorMemberCode?: string | null
  flagCount: number
  moderationNote: string | null
  reviewedAt: string | null
}

export interface AdminReportFlag {
  id: number
  reason: FlagReason
  /** 화면에 쓰지 않는다. 예전 서버는 로그인 닉네임 원문, 새 서버는 reporterDisplayName 과 같은 값. */
  reporterNickname?: string | null
  createdAt: string
  /** 아래 셋은 로그인 닉네임 가리기 이후 서버만 보낸다. 없으면 신고자 이름 없이 보여 준다. */
  reporterId?: number | null
  /** 앱 닉네임 또는 가린 이름("홍**") */
  reporterDisplayName?: string | null
  reporterMemberCode?: string | null
}

/** 댓글 상태(hongikon-be `ReportCommentStatus`). 공개 목록에는 VISIBLE 만 나간다. */
export type AdminCommentStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED'

/**
 * `GET /admin/reports/{id}/comments` 의 한 줄(`AdminCommentResponse`). 숨김·삭제 포함.
 * 작성자는 표시 이름 + 회원 번호로만 보여 준다 — authorNickname(로그인 닉네임 원문일 수 있음)은 화면에 쓰지 않는다.
 */
export interface AdminComment {
  id: number
  reportId: number
  /** 답글이면 최상위 댓글 id */
  parentId?: number | null
  content: string
  status: AdminCommentStatus
  authorId: number
  /** 화면에 쓰지 않는다(예전 서버는 로그인 닉네임 원문). */
  authorNickname?: string | null
  authorDisplayName: string | null
  /** 작성자 공개 회원 번호. 서버가 아직 안 보내면 #id. */
  authorMemberCode?: string | null
  flagCount: number
  /** 사유별 신고 수. 예: { SPAM: 2, PRIVACY: 1 } */
  flagReasons: Partial<Record<FlagReason, number>>
  createdAt: string
  reviewedAt: string | null
}

/**
 * `GET /admin/comments?filter=flagged` 의 한 줄(`AdminFlaggedCommentResponse`). 관리자 댓글 응답에 제보 제목·상태와
 * 검토 뒤 신고 수를 더한 것. 신고자는 오지 않는다(사유별 수만).
 */
export interface AdminFlaggedComment extends AdminComment {
  reportTitle: string
  reportStatus: ReportStatus
  /** 마지막 관리자 검토 뒤 들어온 신고 수 — 자동 숨김(3건) 기준과 같다. */
  pendingFlagCount: number
  lastFlaggedAt: string | null
}

export interface AdminFlaggedCommentList {
  comments: AdminFlaggedComment[]
  /** 검토할 전체 수(목록은 최대 200건). */
  total: number
}

export interface AdminFeedback {
  id: number
  content: string
  contact: string | null
  userId: number | null
  /** 화면에 쓰지 않는다. 예전 서버는 로그인 닉네임 원문, 새 서버는 userDisplayName 과 같은 값. */
  userNickname?: string | null
  status: FeedbackStatus
  createdAt: string
  resolvedAt: string | null
  /** 작성자 표시 이름(앱 닉네임 또는 "홍**")·회원 번호. 로그인 닉네임 가리기 전 서버는 없다. */
  userDisplayName?: string | null
  userMemberCode?: string | null
}

export type UserStatus = 'ACTIVE' | 'SUSPENDED'

/**
 * `GET /admin/users` 한 줄(백엔드 `AdminUserResponse`). 연락처·로그인 닉네임 원문은 오지 않는다(개인정보 최소 처리) —
 * 원문은 `revealLoginName`(GET /admin/users/{id}/login-name)으로만 본다.
 */
export interface AdminUser {
  id: number
  /** 공개 회원 번호(영문 대문자·숫자 10자리, 예: K7Q2M9XA4D). 회원 번호를 내려 주기 전 서버면 없다 — 그때는 #id 를 보여 준다. */
  memberCode?: string | null
  /** 화면에 쓰지 않는다. 예전 서버는 로그인 닉네임 원문, 새 서버는 displayName 과 같은 값. */
  nickname?: string | null
  /** 앱 사용자에게 보이는 이름(앱 닉네임, 없으면 가린 이름 "홍**"). */
  displayName?: string | null
  /**
   * 회원이 직접 정한 앱 닉네임. 없으면 null(→ 카드에 "앱 닉네임 없음"). 키 자체가 없으면 로그인 닉네임 가리기 전
   * 서버라 앱 닉네임 유무를 알 수 없다.
   */
  appNickname?: string | null
  socialType: 'KAKAO' | 'GOOGLE' | 'APPLE' | string
  role: 'USER' | 'ADMIN' | string
  status: UserStatus
  suspendedReason: string | null
  suspendedAt: string | null
  createdAt: string
  /**
   * 정지·위반 삭제 이력이 있던 계정으로 다시 가입한 회원의 이전 기록(탈퇴 후 1년 분리 보관, 백엔드 WithdrawRetention).
   * 해당 없거나 그 기능 전 서버면 null/없음.
   */
  priorHistory?: AdminUserPriorHistory | null
  /** 운영진이 붙인 공식 이름(학생회 등). 없으면 null. 이 기능 전 서버는 키가 없다. */
  officialName?: string | null
}

/** `GET /admin/users/{id}/login-name` — 로그인(카카오/Apple) 닉네임 원문. 버튼을 눌렀을 때만 부른다. */
export interface AdminLoginName {
  userId: number
  loginNickname: string
  socialType: string
}

export interface AdminUserPriorHistory {
  withdrawnAt: string
  retainUntil: string
  rejoinedAt: string | null
  suspendedAt: string | null
  suspendedReason: string | null
  wasSuspendedAtWithdrawal: boolean
  /** 운영진이 위반으로 삭제한 제보 수 */
  violationReportCount: number
}

export type AdminSection = 'dashboard' | 'reports' | 'comments' | 'users' | 'feedback' | 'tools'

/** 대시보드 수치와 그 요청 상태. 웹 콘솔은 AdminApp, 앱 관리 탭은 AdminAccessProvider 가 들고 있다. */
export interface OverviewState {
  data: AdminOverview | null
  loading: boolean
  error: string | null
  /** 마지막으로 성공한 시각(ms) */
  updatedAt: number | null
  refresh: () => void
}
