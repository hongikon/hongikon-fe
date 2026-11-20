import type { NotificationPermission } from '../../lib/notificationPermission'

/** 휴대폰 설정에서 알림이 막혀 있으면(또는 아직 묻지 않았으면) 앱 안 스위치가 켜져 있어도 알림이 오지 않는다. */
export function isSystemNotificationBlocked(permission: NotificationPermission): boolean {
  return permission.status === 'denied' || permission.status === 'undetermined'
}

/** 알림 권한이 꺼져 있으면 '앱 권한' 줄에 바로 보여 찾아 들어가게 한다. 문제가 없으면 undefined. */
export function permissionSummary(permission: NotificationPermission): string | undefined {
  return permission.status === 'granted'
    ? undefined
    : permission.status === 'denied'
      ? '알림 꺼짐'
      : permission.status === 'undetermined'
        ? '알림 확인 필요'
        : undefined
}

/** '알림 받기' 줄 설명. */
export function masterAlertDescription(isGuest: boolean, on: boolean): string {
  return isGuest
    ? '로그인하면 켤 수 있어요'
    : on
      ? '아래에서 켜 둔 알림을 이 기기로 보내드려요'
      : '꺼져 있어 아래 설정과 관계없이 알림이 오지 않아요'
}

/** '구독 알림' 줄 설명. */
export function subscriptionNewsDescription(isGuest: boolean, onCount: number, total: number): string {
  return isGuest
    ? '로그인하면 켤 수 있어요'
    : total === 0
      ? '구독한 게시판이 없어요. 눌러서 게시판을 구독해 보세요'
      : `구독한 게시판의 새 소식을 알려드려요 · ${onCount}/${total}개 켜짐`
}

/** '게시판별 알림' 줄 값. */
export function boardAlertsValue(isGuest: boolean, onCount: number, total: number): string {
  return isGuest ? '로그인 후 사용' : total > 0 ? `${onCount}/${total} 켜짐` : '구독한 게시판 없음'
}

/**
 * 구독 알림 한 번에 켜고 끄기: 켤지(next)와 그때 뒤집어야 할 게시판들.
 * 하나라도 켜져 있으면 켜짐으로 보고 모두 끈다.
 */
export function subscriptionNewsTargets(
  subscribedDepts: readonly string[],
  isOn: (id: string) => boolean,
): { next: boolean; targets: string[] } {
  const next = !subscribedDepts.some(isOn)
  return { next, targets: subscribedDepts.filter((id) => isOn(id) !== next) }
}
