import { ApiError, type ApiRequestOptions } from '../apis/client'
import type { MockMode } from './session'
import type {
  AdminFeedback,
  AdminOverview,
  AdminReport,
  AdminReportFlag,
  FeedbackStatus,
  ReportTargetStatus,
} from './types'

/**
 * 개발 전용 목업 백엔드(`/admin?mock=1`). `api.ts` 가 `__DEV__` 일 때만 동적으로 불러온다.
 * 관리자 API 스펙의 응답 모양을 그대로 흉내 내고, 변경(PATCH/POST)은 이 탭 메모리에만 반영한다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 지금 기준 minutes 분 뒤(음수면 전)의 LocalDateTime 문자열(한국 시간, 존 없음). */
function at(minutes: number): string {
  const kst = new Date(Date.now() + minutes * 60_000 + KST_OFFSET_MS)
  return kst.toISOString().slice(0, 19)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function baseReport(partial: Partial<AdminReport> & Pick<AdminReport, 'id' | 'status' | 'title'>): AdminReport {
  return {
    category: 'EVENT',
    customCategoryLabel: null,
    content: null,
    buildingId: 3,
    buildingName: '제4공학관(T동)',
    floor: 1,
    lat: 37.5509,
    lng: 126.9254,
    startsAt: at(-30),
    endsAt: at(120),
    createdAt: at(-45),
    authorId: 7,
    authorNickname: '와우산다람쥐',
    flagCount: 0,
    moderationNote: null,
    reviewedAt: null,
    ...partial,
  }
}

const reports: AdminReport[] = [
  baseReport({
    id: 31, status: 'PENDING', category: 'FOOD_TRUCK', title: '홍문관 앞 붕어빵 트럭 왔어요',
    content: '팥/슈크림 3개 2천원. 줄이 좀 깁니다. 5시까지 있는다고 하네요.',
    buildingId: 1, buildingName: '홍문관(R동)', floor: null, lat: 37.5513, lng: 126.9245,
    startsAt: at(-20), endsAt: at(150), createdAt: at(-18), authorNickname: '붕어빵헌터',
  }),
  baseReport({
    id: 30, status: 'PENDING', category: 'BOOTH', title: '학생회관 1층 동아리 홍보 부스',
    content: '밴드 동아리 신입 부원 모집합니다! 간식 나눠드려요.',
    buildingId: 5, buildingName: '학생회관(S동)', floor: 1, createdAt: at(-65), authorNickname: '브레멘',
  }),
  baseReport({
    id: 29, status: 'PENDING', category: 'ETC', customCategoryLabel: '분실물', title: '에어팟 케이스 주웠습니다',
    content: 'T동 1층 엘리베이터 앞에서 흰색 에어팟 프로 케이스 주웠어요. 과사에 맡겨둘게요.',
    startsAt: at(-300), endsAt: at(-60), createdAt: at(-310), authorId: null, authorNickname: null,
  }),
  baseReport({
    id: 27, status: 'ACTIVE', category: 'PERFORMANCE', title: '와우 스테이지 버스킹',
    content: '어쿠스틱 공연 30분. 신청곡 받아요.', buildingId: null, buildingName: null, floor: null,
    lat: 37.5518, lng: 126.9237, startsAt: at(60), endsAt: at(120), createdAt: at(-200),
    reviewedAt: at(-190), flagCount: 1,
  }),
  baseReport({
    id: 25, status: 'ACTIVE', category: 'EVENT', title: '중앙도서관 특강: 취업 포트폴리오',
    content: '선착순 50명, 학생증 지참.', buildingId: 8, buildingName: '중앙도서관', floor: 4,
    startsAt: at(-10), endsAt: at(80), createdAt: at(-1500), reviewedAt: at(-1400),
  }),
  baseReport({
    id: 22, status: 'HIDDEN', category: 'FOOD_TRUCK', title: '무료 커피 나눔 (광고 아님)',
    content: '링크 들어가서 회원가입하면 쿠폰 드려요 → bit.ly/xxxx', flagCount: 4,
    createdAt: at(-400), authorNickname: 'coffee_event_01',
  }),
  baseReport({
    id: 19, status: 'REJECTED', category: 'ETC', customCategoryLabel: '홍보', title: '과외 구합니다',
    content: '수학 과외 구해요 연락주세요', createdAt: at(-3000), reviewedAt: at(-2900),
    moderationNote: '캠퍼스 현장 정보가 아닌 개인 광고', startsAt: at(-3000), endsAt: at(-2000),
  }),
]

const flags: Record<number, AdminReportFlag[]> = {
  27: [{ id: 11, reason: 'FALSE_INFO', reporterNickname: '지나가던학생', createdAt: at(-100) }],
  22: [
    { id: 7, reason: 'SPAM', reporterNickname: '홍대생1', createdAt: at(-390) },
    { id: 8, reason: 'SPAM', reporterNickname: null, createdAt: at(-380) },
    { id: 9, reason: 'INAPPROPRIATE', reporterNickname: '와우산다람쥐', createdAt: at(-370) },
    { id: 10, reason: 'ETC', reporterNickname: '밤샘공대생', createdAt: at(-360) },
  ],
}

const feedback: AdminFeedback[] = [
  {
    id: 14, status: 'OPEN', createdAt: at(-15), resolvedAt: null, userId: 7, userNickname: '와우산다람쥐',
    contact: null,
    content: '지도에서 제4공학관 입구 위치가 실제랑 달라요. 정문 쪽 입구가 빠져 있습니다.',
  },
  {
    id: 13, status: 'OPEN', createdAt: at(-240), resolvedAt: null, userId: null, userNickname: null,
    contact: 'student@g.hongik.ac.kr',
    content: '컴퓨터공학과 공지가 소식 탭에 안 올라오는 것 같아요. 어제 올라온 수강신청 공지가 없습니다.',
  },
  {
    id: 12, status: 'OPEN', createdAt: at(-1440), resolvedAt: null, userId: 21, userNickname: '밤샘공대생',
    contact: '010-0000-0000',
    content: '다크모드 지원 계획 있나요?',
  },
  {
    id: 9, status: 'RESOLVED', createdAt: at(-4000), resolvedAt: at(-3000), userId: 3, userNickname: '브레멘',
    contact: null,
    content: '알림이 두 번씩 와요.',
  },
]

let crawlerRunning = false
let crawlerState: AdminOverview['crawler'] = {
  running: false,
  lastStartedAt: at(-42),
  lastFinishedAt: at(-41),
  lastSavedCount: 12,
  lastError: null,
  lastTrigger: 'SCHEDULED',
}

function overview(): AdminOverview {
  const count = (status: AdminReport['status']) => reports.filter((report) => report.status === status).length
  return {
    server: { version: '0.0.1-SNAPSHOT', buildTime: new Date(Date.now() - 5 * 3600_000).toISOString() },
    reports: { pending: count('PENDING'), active: count('ACTIVE'), hidden: count('HIDDEN'), rejected: count('REJECTED') },
    feedback: { open: feedback.filter((item) => item.status === 'OPEN').length },
    news: { total: 11350, missingDepartment: 1200 },
    crawler: { ...crawlerState, running: crawlerRunning },
  }
}

function notFound(): ApiError {
  return new ApiError(404, '요청한 정보를 찾을 수 없습니다.')
}

type MockOptions = Pick<ApiRequestOptions, 'method' | 'body'>

export async function handleMockRequest(path: string, options: MockOptions, mode: MockMode): Promise<unknown> {
  const method = options.method ?? 'GET'
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  const body = (options.body ?? {}) as Record<string, unknown>

  await delay(250 + Math.random() * 350)

  if (mode === 'forbidden') {
    throw new ApiError(403, '이 작업을 할 권한이 없습니다.')
  }

  if (method === 'GET' && pathname === '/admin/overview') return overview()

  if (method === 'GET' && pathname === '/admin/reports') {
    const status = params.get('status') ?? 'PENDING'
    const list = reports
      .filter((report) => report.status !== 'DELETED' && (status === 'ALL' || report.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { reports: list.map((report) => ({ ...report })) }
  }

  const flagMatch = pathname.match(/^\/admin\/reports\/(\d+)\/flags$/)
  if (method === 'GET' && flagMatch) {
    return { flags: flags[Number(flagMatch[1])] ?? [] }
  }

  const reportMatch = pathname.match(/^\/admin\/reports\/(\d+)$/)
  if (method === 'PATCH' && reportMatch) {
    const report = reports.find((item) => item.id === Number(reportMatch[1]))
    if (!report || report.status === 'DELETED') throw notFound()
    const status = body.status as ReportTargetStatus
    if (!['ACTIVE', 'REJECTED', 'HIDDEN', 'DELETED'].includes(status)) {
      throw new ApiError(400, '요청 내용을 확인한 뒤 다시 시도해주세요.')
    }
    report.status = status
    report.reviewedAt = at(0)
    report.moderationNote = typeof body.note === 'string' && body.note ? body.note : report.moderationNote
    return { ...report }
  }

  if (method === 'GET' && pathname === '/admin/feedback') {
    const status = params.get('status') ?? 'OPEN'
    const list = feedback
      .filter((item) => status === 'ALL' || item.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { feedback: list.map((item) => ({ ...item })) }
  }

  const feedbackMatch = pathname.match(/^\/admin\/feedback\/(\d+)$/)
  if (method === 'PATCH' && feedbackMatch) {
    const item = feedback.find((entry) => entry.id === Number(feedbackMatch[1]))
    if (!item) throw notFound()
    item.status = body.status as FeedbackStatus
    item.resolvedAt = item.status === 'RESOLVED' ? at(0) : null
    return { ...item }
  }

  if (method === 'POST' && pathname === '/crawler/trigger') {
    if (crawlerRunning) throw new ApiError(409, '이미 처리된 요청입니다.')
    crawlerRunning = true
    const startedAt = at(0)
    await delay(3000)
    const savedCount = Math.floor(Math.random() * 20)
    crawlerRunning = false
    crawlerState = {
      running: false,
      lastStartedAt: startedAt,
      lastFinishedAt: at(0),
      lastSavedCount: savedCount,
      lastError: null,
      lastTrigger: 'MANUAL',
    }
    return { savedCount }
  }

  if (method === 'POST' && pathname === '/admin/news/backfill-location') {
    await delay(2000)
    return { updatedCount: 300 }
  }

  throw notFound()
}
