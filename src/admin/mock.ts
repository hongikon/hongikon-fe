import { ApiError, type ApiRequestOptions } from '../apis/client'
import type { MockMode } from './session'
import { PARTNER_AFFILIATIONS } from '../constants/partnerAffiliations'
import { PARTNER_CATEGORIES } from '../constants/partnerCategories'
import { FACILITY_KINDS } from '../constants/facilityKinds'
import type {
  AdminBuildingOption,
  AdminFacility,
  AdminPartner,
  AdminComment,
  AdminCommentStatus,
  AdminFeedback,
  AdminFlaggedComment,
  AdminLoginName,
  AdminUser,
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


/** 지금 기준 minutes 분 뒤(음수면 전)의 LocalDateTime 문자열(서버처럼 UTC, 존 없음). */
function at(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString().slice(0, 19)
}

/** 내일 hour 시 정각(한국 시간)의 LocalDateTime 문자열(UTC, 존 없음). 예정 제보 예시용. */
function tomorrowKst(hour: number): string {
  const kstMidnightMs = Math.floor((Date.now() + 9 * 3_600_000) / 86_400_000) * 86_400_000 - 9 * 3_600_000
  return new Date(kstMidnightMs + 86_400_000 + hour * 3_600_000).toISOString().slice(0, 19)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 서버 DisplayNames.mask 와 같은 규칙: "홍길동" → "홍**", 한 글자면 "홍*". */
function mask(name: string): string {
  const chars = Array.from(name.trim())
  if (chars.length === 0) return '익명'
  return chars[0] + '*'.repeat(Math.max(1, chars.length - 1))
}

/**
 * 목업 회원 원장. 로그인 닉네임 원문(loginNickname)은 여기에만 두고 목록·상세 응답에는 싣지 않는다 — 실제 서버처럼
 * `/admin/users/{id}/login-name` 으로만 돌려준다.
 */
const members: Record<number, { loginNickname: string; appNickname: string | null; memberCode: string }> = {
  1: { loginNickname: '김운영', appNickname: '운영자', memberCode: 'Q4M8ZT2KXA' },
  3: { loginNickname: '박부운', appNickname: null, memberCode: '7HC3P9WD1N' },
  7: { loginNickname: '홍길동', appNickname: '와우', memberCode: 'K7Q2M9XA4D' },
  12: { loginNickname: '광고계정', appNickname: '광고봇', memberCode: 'B0RT5YV8LE' },
  15: { loginNickname: '이마포', appNickname: '와우산고양이', memberCode: 'M2X9QWER7T' },
  21: { loginNickname: '박광고', appNickname: null, memberCode: 'Z8N4KD0P3S' },
  31: { loginNickname: '정붕어', appNickname: '붕어빵헌터', memberCode: 'H5T1BB7LQ2' },
  32: { loginNickname: '한밴드', appNickname: '브레멘', memberCode: 'R3V6NM2C8E' },
  40: { loginNickname: '오지나', appNickname: null, memberCode: 'P9W2EX5U1J' },
  41: { loginNickname: '홍대생', appNickname: '홍대생1', memberCode: 'C4L8YG6T0A' },
  42: { loginNickname: '밤공대', appNickname: '밤샘공대생', memberCode: 'U7D3HS9K2F' },
}

/** 앱에 보이는 이름(앱 닉네임, 없으면 가린 로그인 닉네임). 서버 User.getDisplayName 과 같다. */
function displayNameOf(id: number | null): string | null {
  if (id === null) return null
  const member = members[id]
  return member ? member.appNickname ?? mask(member.loginNickname) : null
}

function memberCodeOf(id: number | null): string | null {
  return id === null ? null : members[id]?.memberCode ?? null
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
    flagCount: 0,
    moderationNote: null,
    reviewedAt: null,
    ...partial,
  }
}

/** 새 서버 응답 모양: 작성자는 표시 이름 + 회원 번호, authorNickname 은 표시 이름과 같은 값(구버전 화면 호환 키). */
function reportResponse(report: AdminReport): AdminReport {
  const name = displayNameOf(report.authorId)
  return { ...report, authorNickname: name, authorDisplayName: name, authorMemberCode: memberCodeOf(report.authorId) }
}

function baseUser(partial: Partial<AdminUser> & Pick<AdminUser, 'id'>): AdminUser {
  return {
    memberCode: memberCodeOf(partial.id),
    socialType: 'KAKAO',
    role: 'USER',
    status: 'ACTIVE',
    suspendedReason: null,
    suspendedAt: null,
    createdAt: at(-60 * 24 * 20),
    ...partial,
  }
}

/** 목업에서 "지금 로그인한 관리자"의 회원 id. 자기 자신의 관리자 해제는 400 으로 막는다. */
const MOCK_SELF_ID = 1

const users: AdminUser[] = [
  baseUser({ id: MOCK_SELF_ID, role: 'ADMIN' }),
  baseUser({ id: 3, role: 'ADMIN', socialType: 'APPLE' }),
  baseUser({ id: 7 }),
  baseUser({ id: 12, status: 'SUSPENDED', suspendedReason: '광고 제보 반복', suspendedAt: at(-60 * 5) }),
  baseUser({ id: 15 }),
  baseUser({ id: 21 }),
  baseUser({ id: 31, socialType: 'APPLE' }),
  baseUser({ id: 32 }),
  baseUser({ id: 40 }),
  baseUser({ id: 41 }),
  baseUser({ id: 42 }),
]

/** 새 서버 응답 모양: 로그인 닉네임 원문 없이 표시 이름·앱 닉네임만. nickname 은 표시 이름과 같은 값(구버전 화면 호환 키). */
/** 목업 공식 이름(PUT/DELETE /admin/users/{id}/official). */
const officialNames: Record<number, string> = {}

function userResponse(user: AdminUser): AdminUser {
  const official = officialNames[user.id] ?? null
  const name = official ?? displayNameOf(user.id)
  return { ...user, nickname: name, displayName: name, appNickname: members[user.id]?.appNickname ?? null, officialName: official }
}

const reports: AdminReport[] = [
  baseReport({
    id: 31, status: 'PENDING', category: 'FOOD_TRUCK', title: '홍문관 앞 붕어빵 트럭 왔어요',
    content: '팥/슈크림 3개 2천원. 줄이 좀 깁니다. 5시까지 있는다고 하네요.',
    buildingId: 1, buildingName: '홍문관(R동)', floor: null, lat: 37.5513, lng: 126.9245,
    startsAt: at(-20), endsAt: at(150), createdAt: at(-18), authorId: 31,
    // 사진 썸네일 확인용(개발 목업 전용 외부 이미지)
    imageUrl: 'https://picsum.photos/seed/hongikon-report/800/600',
    imageUrls: [
      'https://picsum.photos/seed/hongikon-report/800/600',
      'https://picsum.photos/seed/hongikon-report-2/600/800',
      'https://picsum.photos/seed/hongikon-report-3/800/800',
    ],
  }),
  baseReport({
    id: 30, status: 'PENDING', category: 'BOOTH', title: '학생회관 1층 동아리 홍보 부스',
    content: '밴드 동아리 신입 부원 모집합니다! 간식 나눠드려요.',
    buildingId: 5, buildingName: '학생회관(S동)', floor: 1, createdAt: at(-65), authorId: 32,
  }),
  baseReport({
    // 예정 제보: 내일 11:00~15:00(미리 올림). 승인해도 시작 시각에 지도에 뜬다.
    id: 33, status: 'PENDING', category: 'FOOD_TRUCK', title: '정문 붕어빵 트럭 (내일)',
    content: '내일 오전 11시부터 3시까지 정문 앞에 붕어빵 트럭 와요.',
    startsAt: tomorrowKst(11), endsAt: tomorrowKst(15), createdAt: at(-5),
  }),
  baseReport({
    id: 29, status: 'PENDING', category: 'ETC', customCategoryLabel: '분실물', title: '에어팟 케이스 주웠습니다',
    content: 'T동 1층 엘리베이터 앞에서 흰색 에어팟 프로 케이스 주웠어요. 과사에 맡겨둘게요.',
    startsAt: at(-300), endsAt: at(-60), createdAt: at(-310), authorId: null,
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
    createdAt: at(-400), authorId: 21,
  }),
  baseReport({
    id: 19, status: 'REJECTED', category: 'ETC', customCategoryLabel: '홍보', title: '과외 구합니다',
    content: '수학 과외 구해요 연락주세요', createdAt: at(-3000), reviewedAt: at(-2900),
    moderationNote: '캠퍼스 현장 정보가 아닌 개인 광고', startsAt: at(-3000), endsAt: at(-2000),
  }),
]

function baseComment(partial: Partial<AdminComment> & Pick<AdminComment, 'id' | 'reportId' | 'content'>): AdminComment {
  return {
    status: 'VISIBLE',
    authorId: 12,
    authorDisplayName: '광고봇',
    flagCount: 0,
    flagReasons: {},
    createdAt: at(-30),
    reviewedAt: null,
    ...partial,
  }
}

/** 제보 댓글(id 오름차순 = 오래된 순). */
const comments: AdminComment[] = [
  baseComment({ id: 101, reportId: 25, content: '지금 3층 엘리베이터 앞까지 줄 있어요', createdAt: at(-40) }),
  baseComment({
    id: 102, reportId: 25, content: '자리 아직 남았나요?', authorId: 15,
    authorDisplayName: '와우산고양이', createdAt: at(-25),
  }),
  baseComment({
    id: 103, reportId: 25, content: '010-1234-5678 로 연락 주세요 자리 팔아요', status: 'HIDDEN', authorId: 21,
    authorDisplayName: '박**', flagCount: 3, flagReasons: { SPAM: 2, PRIVACY: 1 },
    createdAt: at(-15),
  }),
  baseComment({
    id: 104, reportId: 25, parentId: 101, content: '저도 지금 줄 서 있어요', authorId: 15,
    authorDisplayName: '와우산고양이', createdAt: at(-10),
  }),
  baseComment({ id: 105, reportId: 27, content: '신청곡 받나요?', createdAt: at(-5) }),
  baseComment({
    id: 106, reportId: 27, content: '이 버스킹 팀 별로던데 다들 왜 봄?', authorId: 31,
    authorDisplayName: '붕어빵헌터', flagCount: 1, flagReasons: { INAPPROPRIATE: 1 }, createdAt: at(-4),
  }),
  baseComment({
    id: 107, reportId: 25, parentId: 102, content: '자리 남았어요! 오픈채팅 들어오세요', authorId: 12,
    authorDisplayName: '광고봇', flagCount: 2, flagReasons: { SPAM: 2 }, createdAt: at(-3),
  }),
]

/**
 * 마지막 관리자 검토 뒤 들어온 신고(댓글 id → 수·마지막 신고 시각). 서버의 "신고된 댓글" 조건과 같게 쓴다 —
 * 하나라도 있으면 목록에 오르고, PATCH(어떤 상태든)로 검토하면 비운다.
 */
const pendingCommentFlags: Record<number, { count: number; lastAt: string }> = {
  103: { count: 3, lastAt: at(-12) },
  106: { count: 1, lastAt: at(-2) },
  107: { count: 2, lastAt: at(-1) },
}

function flaggedCommentList(): { comments: AdminFlaggedComment[]; total: number } {
  const list = comments
    .filter((comment) => comment.status !== 'DELETED' && (pendingCommentFlags[comment.id]?.count ?? 0) > 0)
    .sort((a, b) => pendingCommentFlags[b.id].lastAt.localeCompare(pendingCommentFlags[a.id].lastAt))
    .map((comment) => {
      const report = reports.find((item) => item.id === comment.reportId)
      return {
        ...commentResponse(comment),
        reportTitle: report?.title ?? `제보 #${comment.reportId}`,
        reportStatus: report?.status ?? 'ACTIVE',
        pendingFlagCount: pendingCommentFlags[comment.id].count,
        lastFlaggedAt: pendingCommentFlags[comment.id].lastAt,
      }
    })
  return { comments: list.slice(0, 200), total: list.length }
}

/** 신고. 응답 때 flagResponse 로 신고자 표시 이름·회원 번호를 채운다. reporterId null 은 서버에 없는 경우(방어 코드 확인용). */
const flags: Record<number, AdminReportFlag[]> = {
  27: [{ id: 11, reason: 'FALSE_INFO', reporterId: 40, createdAt: at(-100) }],
  22: [
    { id: 7, reason: 'SPAM', reporterId: 41, createdAt: at(-390) },
    { id: 8, reason: 'SPAM', reporterId: null, createdAt: at(-380) },
    { id: 9, reason: 'INAPPROPRIATE', reporterId: 7, createdAt: at(-370) },
    { id: 10, reason: 'ETC', reporterId: 42, createdAt: at(-360) },
  ],
}

function flagResponse(flag: AdminReportFlag): AdminReportFlag {
  const id = flag.reporterId ?? null
  const name = displayNameOf(id) ?? '익명'
  return { ...flag, reporterNickname: name, reporterDisplayName: name, reporterMemberCode: memberCodeOf(id) }
}

function commentResponse(comment: AdminComment): AdminComment {
  return { ...comment, authorNickname: comment.authorDisplayName, authorMemberCode: memberCodeOf(comment.authorId) }
}

function feedbackResponse(item: AdminFeedback): AdminFeedback {
  const name = displayNameOf(item.userId)
  return { ...item, userNickname: name, userDisplayName: name, userMemberCode: memberCodeOf(item.userId) }
}

const feedback: AdminFeedback[] = [
  {
    id: 14, status: 'OPEN', createdAt: at(-15), resolvedAt: null, userId: 7,
    contact: null,
    content: '지도에서 제4공학관 입구 위치가 실제랑 달라요. 정문 쪽 입구가 빠져 있습니다.',
  },
  {
    id: 13, status: 'OPEN', createdAt: at(-240), resolvedAt: null, userId: null,
    contact: 'student@g.hongik.ac.kr',
    content: '컴퓨터공학과 공지가 소식 탭에 안 올라오는 것 같아요. 어제 올라온 수강신청 공지가 없습니다.',
  },
  {
    id: 12, status: 'OPEN', createdAt: at(-1440), resolvedAt: null, userId: 21,
    contact: '010-0000-0000',
    content: '다크모드 지원 계획 있나요?',
  },
  {
    id: 9, status: 'RESOLVED', createdAt: at(-4000), resolvedAt: at(-3000), userId: 3,
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
    reports: {
      pending: count('PENDING'),
      // 서버(AdminOverviewController)처럼 '노출 중'은 지금 진행 중, '노출 예정'은 승인했고 시작 전인 것만 센다.
      active: reports.filter((r) => r.status === 'ACTIVE' && Date.parse(r.startsAt + 'Z') <= Date.now() && Date.parse(r.endsAt + 'Z') >= Date.now()).length,
      hidden: count('HIDDEN'),
      rejected: count('REJECTED'),
      upcoming: reports.filter((r) => r.status === 'ACTIVE' && Date.parse(r.startsAt + 'Z') > Date.now()).length,
    },
    feedback: { open: feedback.filter((item) => item.status === 'OPEN').length },
    comments: { flaggedPending: flaggedCommentList().total },
    news: { total: 11350, missingDepartment: 1200 },
    crawler: { ...crawlerState, running: crawlerRunning },
  }
}

// ── 지도 데이터(제휴업체·편의시설) ─────────────────────────────────────
// 화면 확인용 예시다. 업체 이름·좌표는 실제 가게가 아니다(실데이터는 서버 DB 에만 있다).

const mapBuildings: AdminBuildingOption[] = [
  { id: 1, code: 'hongik_r', name: '홍문관 R동' },
  { id: 2, code: 'hongik_k', name: '제1공학관 K동' },
  { id: 8, code: 'hongik_h', name: '중앙도서관 H동' },
  { id: 9, code: 'hongik_g', name: '학생회관 G동' },
  { id: 19, code: 'hongik_t', name: '제4공학관 T동' },
  { id: 20, code: 'hongik_b', name: '인문사회관 B동' },
]

const mapPartners: AdminPartner[] = [
  {
    id: 'mock-cafe-1',
    name: '목업 카페',
    category: '카페',
    affiliations: ['총학생회', '공과대학'],
    lat: 37.5512,
    lng: 126.9241,
    benefit: '전 메뉴 10% 할인',
    affiliationBenefits: [{ affiliation: '공과대학', benefit: '아메리카노 1,000원 할인' }],
    address: '서울 마포구 와우산로 00',
  },
  {
    id: 'mock-food-1',
    name: '목업 식당',
    category: '음식',
    affiliations: ['경영대학'],
    lat: 37.5531,
    lng: 126.9226,
    benefit: '음료 서비스',
    hours: '11:00~21:00',
  },
  {
    id: 'mock-clinic-1',
    name: '목업 검진센터',
    category: '의료/미용',
    affiliations: ['총학생회'],
    mapIcon: '병원',
    lat: 37.5021,
    lng: 127.0251,
    benefit: '검진 비용 20% 할인',
    link: { label: '예약 안내', url: 'https://example.com/booking' },
  },
]

const mapFacilities: AdminFacility[] = [
  { id: 'mock-r-printer', kind: '프린터', buildingCode: 'hongik_r', buildingName: '홍문관 R동', floor: 9, note: 'PC실 앞' },
  { id: 'mock-h-reading', kind: '열람실', buildingCode: 'hongik_h', buildingName: '중앙도서관 H동', floor: 3 },
  { id: 'mock-g-cafe', kind: '카페', buildingCode: 'hongik_g', buildingName: '학생회관 G동', floor: 1, note: '1층 입구' },
  {
    id: 'mock-b-smoking',
    kind: '흡연구역',
    buildingCode: 'hongik_b',
    buildingName: '인문사회관 B동',
    floor: 1,
    note: '건물 뒤 야외',
    lat: 37.5506,
    lng: 126.9258,
  },
]

const PARTNER_CATEGORY_KEYS: readonly string[] = PARTNER_CATEGORIES.map((meta) => meta.key)
const FACILITY_KIND_KEYS: readonly string[] = FACILITY_KINDS.map((meta) => meta.key)

function badRequest(message: string): ApiError {
  return new ApiError(400, '요청 내용을 확인한 뒤 다시 시도해 주세요.', undefined, message)
}

function randomCode(prefix: 'p' | 'f'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || value.length > max) throw badRequest(`${label}은(는) ${max}자까지 쓸 수 있어요.`)
  return value
}

/** 서버 검증 규칙(지도 데이터 계약)과 같은 순서·조건. */
function checkCoords(lat: unknown, lng: unknown): { lat: number; lng: number } {
  if (typeof lat !== 'number' || typeof lng !== 'number' || lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    throw badRequest('좌표는 위도 33~39, 경도 124~132 범위여야 해요.')
  }
  return { lat, lng }
}

function partnerFromBody(body: Record<string, unknown>, id: string): AdminPartner {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length < 1 || name.length > 100) throw badRequest('이름은 1~100자로 입력해 주세요.')
  if (typeof body.category !== 'string' || !PARTNER_CATEGORY_KEYS.includes(body.category)) throw badRequest('업종을 확인해 주세요.')
  const affiliations = Array.isArray(body.affiliations) ? (body.affiliations as string[]) : []
  if (affiliations.some((a) => !(PARTNER_AFFILIATIONS as readonly string[]).includes(a)) || new Set(affiliations).size !== affiliations.length) {
    throw badRequest('제휴 소속을 확인해 주세요.')
  }
  if (body.mapIcon !== undefined && body.mapIcon !== null && body.mapIcon !== '병원') throw badRequest('지도 아이콘을 확인해 주세요.')
  const link = body.link as { label?: unknown; url?: unknown } | undefined
  if (link && (typeof link.url !== 'string' || !link.url.startsWith('https://'))) throw badRequest('링크는 https:// 로 시작해야 해요.')
  const exceptions = Array.isArray(body.affiliationBenefits) ? (body.affiliationBenefits as { affiliation: string; benefit: string }[]) : []
  return {
    id,
    name,
    category: body.category as AdminPartner['category'],
    affiliations: affiliations as AdminPartner['affiliations'],
    mapIcon: body.mapIcon === '병원' ? '병원' : undefined,
    ...checkCoords(body.lat, body.lng),
    benefit: optionalText(body.benefit, '혜택', 255),
    affiliationBenefits: exceptions.length ? (exceptions as AdminPartner['affiliationBenefits']) : undefined,
    address: optionalText(body.address, '주소', 255),
    hours: optionalText(body.hours, '영업시간', 100),
    contact: optionalText(body.contact, '연락처', 50),
    link: link ? { label: optionalText(link.label, '링크 이름', 50) ?? '', url: link.url as string } : undefined,
  }
}

function facilityFromBody(body: Record<string, unknown>, id: string): AdminFacility {
  if (typeof body.kind !== 'string' || !FACILITY_KIND_KEYS.includes(body.kind)) throw badRequest('시설 종류를 확인해 주세요.')
  const building = mapBuildings.find((b) => b.code === body.buildingCode)
  if (!building) throw badRequest('건물을 확인해 주세요.')
  if (body.floor !== undefined && body.floor !== null && !Number.isInteger(body.floor)) throw badRequest('층은 정수로 입력해 주세요.')
  const hasCoords = body.lat !== undefined && body.lat !== null
  return {
    id,
    kind: body.kind as AdminFacility['kind'],
    buildingCode: building.code,
    buildingName: building.name,
    floor: typeof body.floor === 'number' ? body.floor : undefined,
    note: optionalText(body.note, '위치 설명', 255),
    ...(hasCoords ? checkCoords(body.lat, body.lng) : {}),
  }
}

function handleMapRequest(
  method: string,
  pathname: string,
  body: Record<string, unknown>,
  params: URLSearchParams,
): unknown | undefined {
  // 실제 응답처럼 매번 새 객체로 준다 — 원장 배열을 그대로 넘기면 화면 상태와 목업 원장이 같은 배열을 함께 고친다.
  const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
  if (method === 'GET' && pathname === '/admin/map/buildings') return { buildings: copy(mapBuildings) }
  if (method === 'GET' && pathname === '/admin/map/partners') return { partners: copy(mapPartners) }
  if (method === 'GET' && pathname === '/admin/map/facilities') return { facilities: copy(mapFacilities) }

  const isPartner = pathname.startsWith('/admin/map/partners')
  const isFacility = pathname.startsWith('/admin/map/facilities')
  if (!isPartner && !isFacility) return undefined
  const list: { id: string }[] = isPartner ? mapPartners : mapFacilities
  const build = (id: string) => (isPartner ? partnerFromBody(body, id) : facilityFromBody(body, id))

  if (method === 'POST' && (pathname === '/admin/map/partners' || pathname === '/admin/map/facilities')) {
    const requested = typeof body.id === 'string' ? body.id.trim() : ''
    const id = requested || randomCode(isPartner ? 'p' : 'f')
    if (list.some((item) => item.id === id)) throw new ApiError(409, '이미 처리된 요청이에요.', undefined, '같은 코드가 이미 있어요.')
    const created = build(id)
    list.push(created)
    return copy(created)
  }

  const match = pathname.match(/^\/admin\/map\/(partners|facilities)\/([^/]+)$/)
  if (!match) return undefined
  const code = decodeURIComponent(match[2])
  const index = list.findIndex((item) => item.id === code)
  if (index < 0) throw notFound()
  if (method === 'PUT') {
    const updated = build(code)
    list[index] = updated
    return copy(updated)
  }
  if (method === 'DELETE') {
    // 서버와 같다: 제휴업체는 이름을 그대로 입력해야 지운다(앞뒤 공백만 무시).
    if (isPartner && (params.get('confirmName') ?? '').trim() !== (list[index] as AdminPartner).name) {
      throw badRequest('업체 이름이 일치하지 않아요.')
    }
    list.splice(index, 1)
    return undefined
  }
  return undefined
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

  if (pathname.startsWith('/admin/map/')) {
    const result = handleMapRequest(method, pathname, body, params)
    if (result !== undefined || method === 'DELETE') return result
    throw notFound()
  }

  if (method === 'GET' && pathname === '/admin/overview') return overview()

  if (method === 'GET' && pathname === '/admin/reports') {
    const status = params.get('status') ?? 'PENDING'
    const list = reports
      .filter((report) => report.status !== 'DELETED' && (status === 'ALL' || report.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { reports: list.map(reportResponse) }
  }

  const flagMatch = pathname.match(/^\/admin\/reports\/(\d+)\/flags$/)
  if (method === 'GET' && flagMatch) {
    return { flags: (flags[Number(flagMatch[1])] ?? []).map(flagResponse) }
  }

  const commentListMatch = pathname.match(/^\/admin\/reports\/(\d+)\/comments$/)
  if (method === 'GET' && commentListMatch) {
    const reportId = Number(commentListMatch[1])
    return { comments: comments.filter((comment) => comment.reportId === reportId).map(commentResponse) }
  }

  if (method === 'GET' && pathname === '/admin/comments') {
    if ((params.get('filter') ?? 'flagged') !== 'flagged') throw new ApiError(400, 'filter 는 flagged 만 쓸 수 있어요.')
    return flaggedCommentList()
  }

  const commentMatch = pathname.match(/^\/admin\/comments\/(\d+)$/)
  if (method === 'PATCH' && commentMatch) {
    const comment = comments.find((item) => item.id === Number(commentMatch[1]))
    if (!comment) throw notFound()
    const status = body.status as AdminCommentStatus
    if (!['VISIBLE', 'HIDDEN', 'DELETED'].includes(status)) {
      throw new ApiError(400, '요청 내용을 확인한 뒤 다시 시도해주세요.')
    }
    if (typeof body.reason === 'string' && body.reason.length > 200) {
      throw new ApiError(400, '사유는 200자까지 쓸 수 있어요.')
    }
    comment.status = status
    comment.reviewedAt = at(0)
    // 서버처럼 검토하면 그 전 신고는 더 세지 않는다(검토 완료·숨김·삭제·다시 공개 모두).
    delete pendingCommentFlags[comment.id]
    return commentResponse(comment)
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
    // 서버처럼 반려·삭제하면 사진을 지운다.
    if (status === 'REJECTED' || status === 'DELETED') {
      report.imageUrl = null
      report.imageUrls = []
    }
    return reportResponse(report)
  }

  if (method === 'GET' && pathname === '/admin/users') {
    // 백엔드 AdminUserService.search 와 같은 규칙: 회원 번호(대소문자 무시) + 숫자면 id, 아니면 앱 닉네임 일부.
    // 로그인 닉네임으로는 찾지 않는다(개인정보 최소 처리).
    const q = (params.get('q') ?? '').trim()
    if (!q) return { users: users.filter((user) => user.status === 'SUSPENDED').map(userResponse) }
    const code = q.toUpperCase()
    const byCode = /^[A-Z0-9]{10}$/.test(code) ? users.filter((user) => user.memberCode === code) : []
    const rest = /^\d+$/.test(q)
      ? users.filter((user) => user.id === Number(q))
      : users.filter((user) => members[user.id]?.appNickname?.includes(q))
    return { users: [...byCode, ...rest.filter((user) => !byCode.includes(user))].map(userResponse) }
  }
  const loginNameMatch = pathname.match(/^\/admin\/users\/(\d+)\/login-name$/)
  if (method === 'GET' && loginNameMatch) {
    const id = Number(loginNameMatch[1])
    const member = members[id]
    if (!users.some((user) => user.id === id) || !member) {
      throw new ApiError(404, '요청한 정보를 찾을 수 없습니다.', undefined, '존재하지 않는 회원입니다.')
    }
    const user = users.find((item) => item.id === id)
    const response: AdminLoginName = {
      userId: id,
      loginNickname: member.loginNickname,
      socialType: user?.socialType ?? 'KAKAO',
    }
    return response
  }

  const userMatch = pathname.match(/^\/admin\/users\/(\d+)(\/(suspend|unsuspend|grant-admin|revoke-admin|official))?$/)
  if (userMatch) {
    const user = users.find((item) => item.id === Number(userMatch[1]))
    if (!user) throw notFound()
    if (method === 'GET' && !userMatch[3]) return userResponse(user)
    if (method === 'POST' && userMatch[3] === 'suspend') {
      if (user.role === 'ADMIN') throw new ApiError(400, '관리자 계정은 정지할 수 없습니다.')
      user.status = 'SUSPENDED'
      user.suspendedReason = typeof body.reason === 'string' ? body.reason : null
      user.suspendedAt = at(0)
      return userResponse(user)
    }
    if (method === 'POST' && userMatch[3] === 'unsuspend') {
      user.status = 'ACTIVE'
      user.suspendedReason = null
      user.suspendedAt = null
      return userResponse(user)
    }
    // 백엔드 AdminUserService.grantAdmin / revokeAdmin 과 같은 규칙·문구.
    if (method === 'POST' && userMatch[3] === 'grant-admin') {
      if (user.status === 'SUSPENDED') {
        throw new ApiError(400, '요청 내용을 확인한 뒤 다시 시도해 주세요.', undefined, '정지된 회원은 관리자로 지정할 수 없어요. 먼저 정지를 해제해 주세요.')
      }
      user.role = 'ADMIN'
      return userResponse(user)
    }
    // 백엔드 AdminUserService.setOfficialName / clearOfficialName 과 같은 규칙.
    if (method === 'PUT' && userMatch[3] === 'official') {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (name.length < 2 || name.length > 30) throw new ApiError(400, '공식 이름은 2~30자로 입력해 주세요.')
      if (Object.entries(officialNames).some(([id, value]) => value === name && Number(id) !== user.id)) {
        throw new ApiError(409, '같은 공식 이름을 쓰는 계정이 이미 있습니다.')
      }
      officialNames[user.id] = name
      return userResponse(user)
    }
    if (method === 'DELETE' && userMatch[3] === 'official') {
      delete officialNames[user.id]
      return userResponse(user)
    }
    if (method === 'POST' && userMatch[3] === 'revoke-admin') {
      if (user.id === MOCK_SELF_ID) {
        throw new ApiError(400, '요청 내용을 확인한 뒤 다시 시도해 주세요.', undefined, '자기 자신의 관리자 권한은 해제할 수 없어요.')
      }
      user.role = 'USER'
      return userResponse(user)
    }
  }

  if (method === 'GET' && pathname === '/admin/feedback') {
    const status = params.get('status') ?? 'OPEN'
    const list = feedback
      .filter((item) => status === 'ALL' || item.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { feedback: list.map(feedbackResponse) }
  }

  const feedbackMatch = pathname.match(/^\/admin\/feedback\/(\d+)$/)
  if (method === 'PATCH' && feedbackMatch) {
    const item = feedback.find((entry) => entry.id === Number(feedbackMatch[1]))
    if (!item) throw notFound()
    item.status = body.status as FeedbackStatus
    item.resolvedAt = item.status === 'RESOLVED' ? at(0) : null
    return feedbackResponse(item)
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
