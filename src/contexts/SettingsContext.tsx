import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CategoryKey } from '../constants/colors'
import { useAuth } from './AuthContext'
import {
  getNotificationCategories,
  setNotificationCategoryEnabled,
} from '../apis/notifications'
import {
  addMyDepartment,
  getMyDepartments,
  loadDepartmentIdMap,
  removeMyDepartment,
} from '../apis/departments'
import { isRetryableError } from '../apis/client'
import { useReconnect } from '../lib/connectivity'
import { diffDeptSubscriptions, mergeDeptSubscriptions } from '../utils/departmentSync'

const STORAGE_KEY = '@hongik_settings'

interface Settings {
  subscriptionAlert: boolean
  subscribedCategories: CategoryKey[]
  subscribedDepts: string[]
  bookmarkedNews: string[]
}

interface SettingsContextValue {
  settings: Settings
  toggleSubscriptionAlert: () => void
  toggleSubscribedCategory: (cat: CategoryKey) => void
  toggleSubscribedDept: (id: string) => void
  toggleBookmark: (id: string) => void
  isBookmarked: (id: string) => boolean
  resetSettings: () => void
}

export const ALL_CATEGORIES: CategoryKey[] = ['공지', '장학', '행사', '수강', '시설', '취업', '상담']

const DEFAULT_SETTINGS: Settings = {
  subscriptionAlert: true,
  subscribedCategories: ALL_CATEGORIES,
  subscribedDepts: [],
  bookmarkedNews: [],
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
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

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return

        const parsed = JSON.parse(raw) as Partial<Settings>
        const subscribedDepts = migrateSubscribedDepts(parsed.subscribedDepts ?? [])
        const restored = { ...DEFAULT_SETTINGS, ...parsed, subscribedDepts }

        setSettings(restored)

        // 구독이 옮겨졌으면 다음 실행부터 다시 계산하지 않도록 바로 저장한다.
        if (subscribedDepts !== parsed.subscribedDepts) {
          return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(restored))
        }
      })
      .catch((error) => {
        if (__DEV__) console.warn('설정을 불러오지 못해 기본값으로 시작합니다:', error)
      })
      .finally(() => setLoaded(true))
  }, [])

  /**
   * 저장은 상태가 바뀐 뒤에 따라간다.
   *
   * 예전에는 setSettings 의 갱신 함수 안에서 저장까지 했는데 갱신 함수는 순수해야 한다.
   * React 가 같은 갱신 함수를 두 번 부르면 저장도 두 번 일어나고 setState 도 겹쳐 돌았다.
   */
  useEffect(() => {
    if (!loaded) return

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch((error) => {
      if (__DEV__) console.warn('설정을 저장하지 못했습니다:', error)
    })
  }, [settings, loaded])

  /**
   * 서버에 아직 반영하지 못한 카테고리 변경(카테고리 → 켜짐 여부).
   * 끊긴 상태에서 토글해도 화면은 바로 바뀌고, 연결이 돌아오면 마지막 값만 다시 보낸다.
   * PATCH 가 절댓값을 덮어쓰는 요청이라 늦게 다시 보내도 결과가 어긋나지 않는다.
   */
  const pendingCategoryChangesRef = useRef(new Map<CategoryKey, boolean>())
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  // 서버에서 카테고리를 끝내 못 받아온 상태. 재연결·포그라운드 때 다시 부를지 판단한다.
  const [categoryFetchFailed, setCategoryFetchFailed] = useState(false)
  const [categoryFetchNonce, setCategoryFetchNonce] = useState(0)

  // 로그아웃·계정 전환 시 이전 계정의 미전송 변경을 다른 계정에 보내면 안 된다.
  // 서버 값을 받아오는 아래 효과보다 먼저 돌아야 해서 앞에 둔다.
  useEffect(() => {
    pendingCategoryChangesRef.current.clear()
    setCategoryFetchFailed(false)
  }, [accessToken])

  /**
   * 로그인하면 서버에 저장된 카테고리 설정이 기기 로컬 값을 덮는다 — 로그인한
   * 사용자에게는 서버가 진실 소스다. 게스트(accessToken 없음)는 계속 로컬 값만 쓴다.
   * 단, 아직 서버에 못 보낸 변경은 사용자가 방금 고른 값이라 서버 값보다 우선한다.
   */
  useEffect(() => {
    if (!loaded || !accessToken) return

    let cancelled = false
    getNotificationCategories(accessToken)
      .then((categories) => {
        if (cancelled) return
        setCategoryFetchFailed(false)
        const pending = pendingCategoryChangesRef.current
        const enabled = categories
          .filter((c) => pending.get(c.category) ?? c.enabled)
          .map((c) => c.category)
        setSettings((prev) => ({ ...prev, subscribedCategories: enabled }))
      })
      .catch((error) => {
        if (cancelled) return
        // 로컬 값으로 계속 쓸 수 있어 화면을 막지 않는다. 연결이 돌아오면 다시 받아온다.
        setCategoryFetchFailed(isRetryableError(error))
        if (__DEV__) console.warn('알림 카테고리 설정을 불러오지 못했습니다:', error)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, loaded, categoryFetchNonce])

  /** 못 보낸 변경을 다시 보낸다. 보내는 사이 사용자가 또 바꿨으면 그 값은 남겨 둔다. */
  const flushPendingCategoryChanges = useCallback(() => {
    if (!accessToken) return
    const pending = pendingCategoryChangesRef.current
    pending.forEach((enabled, category) => {
      setNotificationCategoryEnabled(category, enabled, accessToken)
        .then(() => {
          if (pending.get(category) === enabled) pending.delete(category)
        })
        .catch((error) => {
          if (!isRetryableError(error)) pending.delete(category)
          if (__DEV__) console.warn('알림 카테고리 설정을 다시 저장하지 못했습니다:', error)
        })
    })
  }, [accessToken])

  /**
   * 학과 구독 서버 동기화. 학과 소식 푸시는 서버 `user_departments` 에 있는 구독자에게만 가서
   * (`UserDeviceRepository.findPushTargets`), 로컬에만 두면 아무도 받지 못한다.
   *
   * - 서버에 아직 반영하지 못한 학과 변경(리프 id → 구독 여부). 카테고리와 같은 방식으로
   *   화면은 바로 바꾸고, 연결이 돌아오면 마지막 값만 다시 보낸다.
   * - 학과가 아닌 '대학' 게시판(학사·장학 등)은 서버 학과 목록에 없어 로컬에만 둔다.
   * - 게스트는 지금처럼 로컬에만 둔다.
   */
  const pendingDeptChangesRef = useRef(new Map<string, boolean>())
  /** 지금 서버로 보내는 중인 리프. 같은 리프의 POST·DELETE 가 겹쳐 순서가 뒤집히지 않게 하나씩 보낸다. */
  const deptInFlightRef = useRef(new Set<string>())
  const accessTokenRef = useRef(accessToken)
  accessTokenRef.current = accessToken
  const isLoggedIn = Boolean(accessToken)
  /** 로그인 직후 합치기가 끝났는지. 끝나기 전 실패하면 재연결·포그라운드 때 다시 한다. */
  const [deptSyncFailed, setDeptSyncFailed] = useState(false)
  const [deptSyncNonce, setDeptSyncNonce] = useState(0)

  // 로그아웃하면 이전 계정의 미전송 변경을 버린다. 토큰 재발급(accessToken 값만 바뀜)에는 비우지 않는다 —
  // 계정이 바뀌려면 반드시 로그아웃(null)을 거친다.
  useEffect(() => {
    if (isLoggedIn) return
    pendingDeptChangesRef.current.clear()
    setDeptSyncFailed(false)
  }, [isLoggedIn])

  /** 리프 하나의 마지막 변경을 서버에 보낸다. 보내는 사이 또 바뀌었으면 끝난 뒤 새 값을 이어 보낸다. */
  const flushDeptChange = useCallback(async (leaf: string): Promise<void> => {
    const pending = pendingDeptChangesRef.current
    const inFlight = deptInFlightRef.current
    const token = accessTokenRef.current
    const subscribed = pending.get(leaf)
    if (!token || subscribed === undefined || inFlight.has(leaf)) return

    inFlight.add(leaf)
    let sent = false
    try {
      const departmentId = (await loadDepartmentIdMap()).get(leaf)
      if (departmentId !== undefined) {
        await (subscribed
          ? addMyDepartment(departmentId, token)
          : removeMyDepartment(departmentId, token))
      }
      // 학과가 아닌 리프(대학 게시판)는 보낼 곳이 없어 그대로 끝낸다.
      if (pending.get(leaf) === subscribed) pending.delete(leaf)
      sent = true
    } catch (error) {
      if (isRetryableError(error)) {
        // 값을 남겨 두었다가 재연결·포그라운드 때 다시 보낸다.
        if (__DEV__) console.warn('학과 구독을 서버에 저장하지 못해 연결되면 다시 보냅니다:', error)
      } else {
        // 서버가 거절한 변경은 다시 보내도 같다. 로컬 구독은 소식 피드 필터로도 쓰여 되돌리지 않고 남겨 둔다.
        if (pending.get(leaf) === subscribed) pending.delete(leaf)
        if (__DEV__) console.warn('학과 구독 저장이 거절되었습니다:', error)
      }
    } finally {
      inFlight.delete(leaf)
    }
    if (sent && pending.has(leaf)) void flushDeptChange(leaf)
  }, [])

  const flushPendingDeptChanges = useCallback(() => {
    pendingDeptChangesRef.current.forEach((_, leaf) => {
      void flushDeptChange(leaf)
    })
  }, [flushDeptChange])

  /** 서버 구독을 원하는 값으로 맞춘다. 차이 나는 학과만 대기열에 넣어 보낸다. */
  const queueDeptChanges = useCallback(
    (leaves: Iterable<string>, subscribed: boolean) => {
      for (const leaf of leaves) pendingDeptChangesRef.current.set(leaf, subscribed)
      flushPendingDeptChanges()
    },
    [flushPendingDeptChanges],
  )

  /**
   * 로그인하면 서버 구독과 로컬 구독을 합집합으로 합친다(이유는 `mergeDeptSubscriptions` 주석).
   * 합친 뒤 서버에 없는 학과는 추가하고, 방금 해지했지만 아직 못 보낸 학과는 지운다.
   */
  useEffect(() => {
    if (!loaded || !isLoggedIn) return

    let cancelled = false
    ;(async () => {
      const token = accessTokenRef.current
      if (!token) return
      const [idByLeaf, mine] = await Promise.all([loadDepartmentIdMap(), getMyDepartments(token)])
      if (cancelled) return

      const serverIds = mine.map((d) => d.departmentId)
      const pendingRemovals = new Set(
        [...pendingDeptChangesRef.current].filter(([, on]) => !on).map(([leaf]) => leaf),
      )
      const merged = mergeDeptSubscriptions(
        settingsRef.current.subscribedDepts,
        serverIds,
        idByLeaf,
        pendingRemovals,
      )
      setSettings((prev) => ({
        ...prev,
        // 기다리는 사이 사용자가 바꾼 값(prev)을 기준으로 다시 합친다.
        subscribedDepts: mergeDeptSubscriptions(prev.subscribedDepts, serverIds, idByLeaf, pendingRemovals),
      }))
      setDeptSyncFailed(false)

      const leafById = new Map([...idByLeaf].map(([leaf, id]) => [id, leaf]))
      const { toAdd, toRemove } = diffDeptSubscriptions(merged, serverIds, idByLeaf)
      const pending = pendingDeptChangesRef.current
      // 이미 대기 중인 리프는 그 값이 더 최신이라 건드리지 않는다.
      const toLeaves = (ids: number[]) =>
        ids.map((id) => leafById.get(id)!).filter((leaf) => !pending.has(leaf))
      queueDeptChanges(toLeaves(toAdd), true)
      queueDeptChanges(toLeaves(toRemove), false)
    })().catch((error) => {
      if (cancelled) return
      // 로컬 값으로 계속 쓸 수 있어 화면을 막지 않는다. 연결이 돌아오면 다시 합친다.
      setDeptSyncFailed(isRetryableError(error))
      if (__DEV__) console.warn('학과 구독을 서버와 맞추지 못했습니다:', error)
    })

    return () => {
      cancelled = true
    }
  }, [isLoggedIn, loaded, deptSyncNonce, queueDeptChanges])

  const recoverCategorySync = useCallback(() => {
    if (!accessToken) return
    if (categoryFetchFailed) setCategoryFetchNonce((n) => n + 1)
    if (pendingCategoryChangesRef.current.size > 0) flushPendingCategoryChanges()
    if (deptSyncFailed) setDeptSyncNonce((n) => n + 1)
    if (pendingDeptChangesRef.current.size > 0) flushPendingDeptChanges()
  }, [accessToken, categoryFetchFailed, flushPendingCategoryChanges, deptSyncFailed, flushPendingDeptChanges])

  useReconnect(recoverCategorySync, Boolean(accessToken))

  useEffect(() => {
    if (!accessToken) return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') recoverCategorySync()
    })
    return () => subscription.remove()
  }, [accessToken, recoverCategorySync])

  const toggleSubscriptionAlert = useCallback(() => {
    setSettings((prev) => ({ ...prev, subscriptionAlert: !prev.subscriptionAlert }))
  }, [])

  /**
   * 화면은 바로 바꾸고(낙관적 반영) 서버 저장은 뒤따른다. 서버 호출은 setSettings 갱신 함수
   * 밖에서 한다 — 갱신 함수는 순수해야 하고, React 가 두 번 부르면 요청도 두 번 나간다.
   */
  const toggleSubscribedCategory = useCallback(
    (cat: CategoryKey) => {
      const nextEnabled = !settingsRef.current.subscribedCategories.includes(cat)
      const applyLocal = (enabled: boolean) =>
        setSettings((prev) => {
          const without = prev.subscribedCategories.filter((c) => c !== cat)
          return { ...prev, subscribedCategories: enabled ? [...without, cat] : without }
        })

      applyLocal(nextEnabled)
      if (!accessToken) return

      const pending = pendingCategoryChangesRef.current
      pending.set(cat, nextEnabled)
      setNotificationCategoryEnabled(cat, nextEnabled, accessToken)
        .then(() => {
          if (pending.get(cat) === nextEnabled) pending.delete(cat)
        })
        .catch((error) => {
          // 연결 문제면 값을 남겨 두었다가 재연결 때 다시 보낸다.
          if (isRetryableError(error)) {
            if (__DEV__) console.warn('알림 카테고리 설정을 저장하지 못해 연결되면 다시 보냅니다:', error)
            return
          }
          // 서버가 거절한 변경(권한·입력 오류)은 다시 보내도 같으니 화면을 서버 상태로 되돌린다.
          if (pending.get(cat) === nextEnabled) {
            pending.delete(cat)
            applyLocal(!nextEnabled)
          }
          if (__DEV__) console.warn('알림 카테고리 설정이 거절되었습니다:', error)
        })
    },
    [accessToken],
  )

  /** 화면은 바로 바꾸고(낙관적 반영), 로그인 상태면 서버 구독도 뒤따라 맞춘다. 실패해도 화면은 막지 않는다. */
  const toggleSubscribedDept = useCallback(
    (id: string) => {
      const nextSubscribed = !settingsRef.current.subscribedDepts.includes(id)
      setSettings((prev) => ({
        ...prev,
        subscribedDepts: toggleInList(prev.subscribedDepts, id),
      }))
      if (accessTokenRef.current) queueDeptChanges([id], nextSubscribed)
    },
    [queueDeptChanges],
  )

  const toggleBookmark = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      bookmarkedNews: toggleInList(prev.bookmarkedNews, id),
    }))
  }, [])

  const isBookmarked = useCallback(
    (id: string) => settings.bookmarkedNews.includes(id),
    [settings.bookmarkedNews]
  )

  const resetSettings = useCallback(() => {
    // 초기화하면 구독 학과가 비므로 서버 구독도 해지한다 — 안 그러면 다음 로그인 때 합치기로 되살아난다.
    if (accessTokenRef.current) queueDeptChanges(settingsRef.current.subscribedDepts, false)
    setSettings(DEFAULT_SETTINGS)
  }, [queueDeptChanges])

  /**
   * 값을 매 렌더 새 객체로 만들면 설정을 건드리지 않아도 모든 소비자가 다시 그려진다.
   * 소식 목록처럼 항목이 많은 화면에서 특히 크게 걸린다.
   */
  const value = useMemo(
    () => ({
      settings,
      toggleSubscriptionAlert,
      toggleSubscribedCategory,
      toggleSubscribedDept,
      toggleBookmark,
      isBookmarked,
      resetSettings,
    }),
    [
      settings,
      toggleSubscriptionAlert,
      toggleSubscribedCategory,
      toggleSubscribedDept,
      toggleBookmark,
      isBookmarked,
      resetSettings,
    ]
  )

  if (!loaded) return null

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
