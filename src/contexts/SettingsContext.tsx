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
import { isRetryableError } from '../apis/client'
import { useReconnect } from '../lib/connectivity'

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

  const recoverCategorySync = useCallback(() => {
    if (!accessToken) return
    if (categoryFetchFailed) setCategoryFetchNonce((n) => n + 1)
    if (pendingCategoryChangesRef.current.size > 0) flushPendingCategoryChanges()
  }, [accessToken, categoryFetchFailed, flushPendingCategoryChanges])

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

  const toggleSubscribedDept = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      subscribedDepts: toggleInList(prev.subscribedDepts, id),
    }))
  }, [])

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
    setSettings(DEFAULT_SETTINGS)
  }, [])

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
