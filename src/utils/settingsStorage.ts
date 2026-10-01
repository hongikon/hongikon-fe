import type { CategoryKey } from '../constants/colors'
import { normalizeBoardState } from './boardSubscriptionSync'

/**
 * 기기에 저장하는 설정(`@hongik_settings`)의 모양과, 예전 버전이 저장한 값을 지금 모양으로 옮기는 함수.
 * React·AsyncStorage 에 기대지 않아 따로 검증할 수 있다. 상태 관리는 `SettingsContext` 가 한다.
 */

export interface Settings {
  /** '구독 소식 알림' 전체 스위치. 끄면 이 기기를 푸시 대상에서 뺀다(`usePushNotifications`). */
  subscriptionAlert: boolean
  /**
   * 알림 받을 분야. 서버 `notification-categories` 와 맞춘다 — 구독한 모든 게시판의 푸시에 적용된다.
   * 구독 탭 피드는 이 값으로 거르지 않는다(예전 `subscribedCategories` 는 둘을 겸해 헷갈렸다).
   */
  alertCategories: CategoryKey[]
  /** 구독한 게시판(TREE_DATA 리프 id). 학과와 '대학' 게시판을 모두 포함한다. */
  subscribedDepts: string[]
  /** 구독은 유지하되 알림을 끈 게시판. 항상 `subscribedDepts` 의 부분집합 — 새로 구독하면 알림은 켜진 채 시작한다. */
  mutedDepts: string[]
  bookmarkedNews: string[]
}

export const ALL_CATEGORIES: CategoryKey[] = ['공지', '장학', '행사', '수강', '시설', '취업', '상담']

export const DEFAULT_SETTINGS: Settings = {
  subscriptionAlert: true,
  alertCategories: ALL_CATEGORIES,
  subscribedDepts: [],
  mutedDepts: [],
  bookmarkedNews: [],
}

/**
 * 없어진 구독 단위 → 이를 대체하는 단위들.
 *
 * TREE_DATA 에서 학과를 쪼개면 기존 구독 값이 어디에도 안 붙는 고아가 된다.
 * 여기에 적어두면 앱을 켤 때 새 단위로 옮겨준다.
 */
const DEPT_MIGRATIONS: Record<string, string[]> = {
  신소재화공시스템공학부: ['신소재공학전공', '화학공학전공'],
  /** 없어진 구독 단위는 빈 배열로 둔다. 저장돼 있던 값이 그대로 사라진다. */
  교양과: [],
}

/** 옮길 게 없으면 원본 참조를 그대로 돌려줘 불필요한 저장을 피한다. */
function migrateSubscribedDepts(depts: string[]): string[] {
  if (!depts.some((id) => id in DEPT_MIGRATIONS)) return depts

  const migrated = depts.flatMap((id) => DEPT_MIGRATIONS[id] ?? [id])
  return [...new Set(migrated)]
}

/** 예전 버전이 저장한 모양. `subscribedCategories` 는 피드 필터와 알림 분야를 겸하던 값이다. */
export type StoredSettings = Partial<Settings> & { subscribedCategories?: CategoryKey[] }

/**
 * 저장된 설정을 지금 모양으로 옮긴다. 바뀐 게 있으면 `changed` 로 알려 바로 다시 저장하게 한다.
 *
 * `subscribedCategories` → `alertCategories`: 예전 값은 토글할 때마다 서버 알림 분야로도 보내졌으니
 * 실제 푸시 설정과 같다. 그대로 알림 분야로 옮겨 사용자가 받던 알림이 바뀌지 않게 한다.
 * 대신 구독 탭 피드는 이제 분야로 거르지 않고 구독한 게시판의 소식을 모두 보여준다.
 */
export function restoreSettings(parsed: StoredSettings): { settings: Settings; changed: boolean } {
  const { subscribedCategories: legacyCategories, ...rest } = parsed
  const subscribedDepts = migrateSubscribedDepts(rest.subscribedDepts ?? [])
  const mutedDepts = migrateSubscribedDepts(rest.mutedDepts ?? [])
  const alertCategories = rest.alertCategories ?? legacyCategories ?? ALL_CATEGORIES
  const boards = normalizeBoardState({ subscribed: subscribedDepts, muted: mutedDepts })

  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...rest,
    alertCategories,
    subscribedDepts: boards.subscribed,
    mutedDepts: boards.muted,
  }
  const changed =
    legacyCategories !== undefined ||
    rest.alertCategories === undefined ||
    subscribedDepts !== rest.subscribedDepts ||
    boards.muted !== (rest.mutedDepts ?? [])
  return { settings, changed }
}

