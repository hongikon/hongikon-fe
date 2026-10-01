import { ApiError, apiRequest } from './client'

/**
 * 게시판 구독(`/users/me/subscriptions`). 학과뿐 아니라 '대학' 게시판(학사·장학 등)까지
 * TREE_DATA 리프 id 전부가 `sourceId` 다. 새 소식 푸시는 아래 세 조건을 모두 만족할 때만 간다.
 *
 * 1. 그 게시판을 구독했다
 * 2. 그 게시판의 알림(`alertEnabled`)이 켜져 있다
 * 3. 그 소식 분야의 알림(`/users/me/notification-categories`)이 켜져 있다
 */
export interface BoardSubscription {
  sourceId: string
  alertEnabled: boolean
  createdAt: string
}

/** 리프 id 는 한글이라 경로에 넣기 전에 반드시 인코딩한다. */
function subscriptionPath(sourceId: string): string {
  return `/users/me/subscriptions/${encodeURIComponent(sourceId)}`
}

/**
 * 이번 실행 동안 서버에 구독 API 가 없다고 판정했는지. 한 번 판정되면 더는 요청하지 않는다 —
 * 지금 서버는 없는 경로에도 401 을 줘서(아래 `isSubscriptionApiMissing`), 요청마다 토큰 재발급을
 * 한 번씩 태우고 다시 401 을 받게 된다. 앱을 다시 켜면 처음부터 다시 확인한다.
 */
let apiMissing = false

/** 판정이 끝난 뒤의 호출은 네트워크 없이 바로 이 오류로 실패시킨다(404 와 같은 취급). */
function missingError(): ApiError {
  return new ApiError(404, '요청한 정보를 찾을 수 없습니다.')
}

/** 실패가 "API 없음"이면 기억해 둔다. 오류는 그대로 다시 던진다. */
async function probe<T>(run: () => Promise<T>): Promise<T> {
  if (apiMissing) throw missingError()
  try {
    return await run()
  } catch (error) {
    if (isSubscriptionApiMissing(error)) apiMissing = true
    throw error
  }
}

/** 내 게시판 구독 목록. */
export async function getMySubscriptions(accessToken: string): Promise<BoardSubscription[]> {
  return probe(() => fetchMySubscriptions(accessToken))
}

async function fetchMySubscriptions(accessToken: string): Promise<BoardSubscription[]> {
  const res = await apiRequest<{ subscriptions: BoardSubscription[] }>('/users/me/subscriptions', {
    accessToken,
  })
  return res?.subscriptions ?? []
}

/**
 * 구독 추가·알림 켜고 끄기를 한 번에(upsert). 절댓값을 덮어쓰는 PUT 이라 응답이 끊겨 다시 보내도 안전하다.
 * 서버가 모르는 sourceId 면 400.
 */
export function putMySubscription(
  sourceId: string,
  alertEnabled: boolean,
  accessToken: string,
): Promise<BoardSubscription> {
  return probe(() =>
    apiRequest<BoardSubscription>(subscriptionPath(sourceId), {
      method: 'PUT',
      body: { alertEnabled },
      accessToken,
    }),
  )
}

/** 구독 해지. 서버는 이미 없어도 204 를 준다(멱등). */
export async function deleteMySubscription(sourceId: string, accessToken: string): Promise<void> {
  await probe(() => apiRequest<void>(subscriptionPath(sourceId), { method: 'DELETE', accessToken }))
}

/**
 * 서버에 구독 API 가 아직 없는지(배포 전). 계약상 이 경로들은 404 를 주지 않는다 —
 * DELETE 는 멱등 204, 모르는 sourceId 는 400 — 그래서 404 는 "엔드포인트 자체가 없다"로 본다.
 *
 * 지금 배포된 서버는 없는 경로를 404 대신 401 로 돌려준다(Spring `/error` 가 인증을 요구해서 —
 * 백엔드 PR #4 에서 고침, 아직 미배포). 그래서 "토큰을 막 재발급받아 다시 보냈는데도 401" 도
 * 없는 것으로 본다. 진짜 로그인 만료는 재발급 자체가 실패해 이 표시가 붙지 않는다.
 */
export function isSubscriptionApiMissing(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.status === 404 || (error.status === 401 && error.afterTokenRefresh === true)
}

/** 검증용: 판정을 처음 상태로 되돌린다. */
export function resetSubscriptionApiProbe(): void {
  apiMissing = false
}
