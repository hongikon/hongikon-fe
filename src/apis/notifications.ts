import { apiRequest } from './client'
import type { CategoryKey } from '../constants/colors'

export interface NotificationCategoryState {
  category: CategoryKey
  enabled: boolean
}

/**
 * 내 알림 카테고리 설정 조회. 저장된 적 없는 카테고리는 서버가 기본값(true)으로
 * 채워 7개 전부를 돌려준다(`NotificationCategoryService.getUserCategories`).
 */
export function getNotificationCategories(
  accessToken: string,
): Promise<NotificationCategoryState[]> {
  return apiRequest<{ categories: NotificationCategoryState[] }>(
    '/users/me/notification-categories',
    { accessToken },
  ).then((res) => res.categories)
}

export function setNotificationCategoryEnabled(
  category: CategoryKey,
  enabled: boolean,
  accessToken: string,
): Promise<NotificationCategoryState> {
  return apiRequest<NotificationCategoryState>(
    `/users/me/notification-categories/${encodeURIComponent(category)}`,
    // PATCH 지만 "켜짐/꺼짐" 절댓값을 덮어쓰는 요청이라 여러 번 보내도 결과가 같아 재시도를 허락한다.
    { method: 'PATCH', body: { enabled }, accessToken, retries: 2 },
  )
}

export interface KeywordSubscription {
  id: number
  keyword: string
}

/**
 * 자유 키워드 알림 구독. 아직 이 기능을 쓰는 화면이 없다 — 학과/카테고리
 * 구독(`SettingsContext`)과는 다른 축이라, 붙이려면 별도 입력 UI가 필요하다.
 */
export function getKeywordSubscriptions(accessToken: string): Promise<KeywordSubscription[]> {
  return apiRequest<{ keywords: KeywordSubscription[] }>(
    '/users/me/keyword-subscriptions',
    { accessToken },
  ).then((res) => res.keywords)
}

export function createKeywordSubscription(
  keyword: string,
  accessToken: string,
): Promise<KeywordSubscription> {
  return apiRequest<KeywordSubscription>('/users/me/keyword-subscriptions', {
    method: 'POST',
    body: { keyword },
    accessToken,
  })
}

export function deleteKeywordSubscription(id: number, accessToken: string): Promise<void> {
  return apiRequest<void>(`/users/me/keyword-subscriptions/${id}`, {
    method: 'DELETE',
    accessToken,
  })
}
