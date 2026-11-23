import { OFFICIAL_REQUEST_PREFIX } from '../../../constants/feedback'

/** 신청 글 첫 줄 머리말 뒤의 단체 이름. 서버가 officialRequestName 을 주기 전 버전일 때만 쓴다. */
export function requestedNameOf(content: string): string {
  return content.slice(OFFICIAL_REQUEST_PREFIX.length).split('\n')[0].trim()
}

/** 알림으로 연 항목을 맨 위로(나머지 순서는 그대로). */
export function withFocusedFirst<T extends { id: number }>(items: T[], focusId: number | null): T[] {
  if (focusId === null) return items
  const focused = items.find((item) => item.id === focusId)
  return focused ? [focused, ...items.filter((item) => item !== focused)] : items
}
