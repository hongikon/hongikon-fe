/** 알림으로 연 항목을 맨 위로(나머지 순서는 그대로). 제보 검토·신고 댓글이 함께 쓴다. */
export function withFocusedFirst<T extends { id: number }>(items: T[], focusId: number | null): T[] {
  if (focusId === null) return items
  const focused = items.find((item) => item.id === focusId)
  return focused ? [focused, ...items.filter((item) => item !== focused)] : items
}
