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

/** 내 게시판 구독 목록. */
export async function getMySubscriptions(accessToken: string): Promise<BoardSubscription[]> {
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
  return apiRequest<BoardSubscription>(subscriptionPath(sourceId), {
    method: 'PUT',
    body: { alertEnabled },
    accessToken,
  })
}

/** 구독 해지. 서버는 이미 없어도 204 를 준다(멱등). */
export async function deleteMySubscription(sourceId: string, accessToken: string): Promise<void> {
  await apiRequest<void>(subscriptionPath(sourceId), { method: 'DELETE', accessToken })
}

/**
 * 서버에 구독 API 가 아직 없는지(배포 전). 계약상 이 경로들은 404 를 주지 않는다 —
 * DELETE 는 멱등 204, 모르는 sourceId 는 400 — 그래서 404 는 "엔드포인트 자체가 없다"로 본다.
 */
export function isSubscriptionApiMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
