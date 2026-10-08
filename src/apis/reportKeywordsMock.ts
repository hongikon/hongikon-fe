import { ApiError } from './client'
import type { NewReportsScope } from './notificationSettings'
import { MAX_REPORT_KEYWORDS, type ReportKeyword } from './reportKeywords'

/**
 * 개발 전용 제보 키워드 목업(`?mock=1`). `reportKeywords.ts` 가 `__DEV__` 웹에서만 동적으로 불러온다.
 * 서버 계약(중복 409, 30개 상한 400)을 흉내 내고, 바뀐 값은 이 탭 메모리에만 둔다.
 */
let keywords: ReportKeyword[] = [
  { id: 1, keyword: '간식' },
  { id: 2, keyword: '붕어빵' },
]
let nextId = 3
let scope: NewReportsScope = 'KEYWORDS'

function delay(ms = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function mockGetReportKeywords(): Promise<ReportKeyword[]> {
  await delay()
  return keywords.map((k) => ({ ...k }))
}

export async function mockCreateReportKeyword(raw: string): Promise<ReportKeyword> {
  await delay()
  const keyword = raw.trim()
  if (!keyword) throw new ApiError(400, '키워드를 입력해 주세요.')
  // 일부러 실패를 보고 싶을 때: '실패' 를 넣으면 서버 오류처럼 굴어 되돌리기와 토스트를 확인할 수 있다.
  if (keyword === '실패') throw new ApiError(500, '잠시 뒤 다시 시도해 주세요.')
  if (keywords.some((k) => k.keyword.toLowerCase() === keyword.toLowerCase())) {
    throw new ApiError(409, '이미 등록한 키워드예요.')
  }
  if (keywords.length >= MAX_REPORT_KEYWORDS) {
    throw new ApiError(400, `제보 키워드는 ${MAX_REPORT_KEYWORDS}개까지 등록할 수 있어요.`)
  }
  const created = { id: nextId++, keyword }
  keywords = [...keywords, created]
  return { ...created }
}

export async function mockDeleteReportKeyword(id: number): Promise<void> {
  await delay()
  keywords = keywords.filter((k) => k.id !== id)
}

export async function mockGetScope(): Promise<NewReportsScope> {
  await delay(150)
  return scope
}

export async function mockPatchScope(next: NewReportsScope): Promise<NewReportsScope> {
  await delay()
  scope = next
  return scope
}
