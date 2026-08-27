import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CategoryKey } from '../constants/colors'
import { useAuth } from './AuthContext'
import {
  getNotificationCategories,
  setNotificationCategoryEnabled,
} from '../apis/notifications'

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
        console.warn('설정을 불러오지 못해 기본값으로 시작합니다:', error)
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
      console.warn('설정을 저장하지 못했습니다:', error)
    })
  }, [settings, loaded])

  /**
   * 로그인하면 서버에 저장된 카테고리 설정이 기기 로컬 값을 덮는다 — 로그인한
   * 사용자에게는 서버가 진실 소스다. 게스트(accessToken 없음)는 계속 로컬 값만 쓴다.
   */
  useEffect(() => {
    if (!loaded || !accessToken) return

    let cancelled = false
    getNotificationCategories(accessToken)
      .then((categories) => {
        if (cancelled) return
        const enabled = categories.filter((c) => c.enabled).map((c) => c.category)
        setSettings((prev) => ({ ...prev, subscribedCategories: enabled }))
      })
      .catch((error) => {
        console.warn('알림 카테고리 설정을 불러오지 못했습니다:', error)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, loaded])

  const toggleSubscriptionAlert = useCallback(() => {
    setSettings((prev) => ({ ...prev, subscriptionAlert: !prev.subscriptionAlert }))
  }, [])

  const toggleSubscribedCategory = useCallback(
    (cat: CategoryKey) => {
      setSettings((prev) => {
        const nextEnabled = !prev.subscribedCategories.includes(cat)

        if (accessToken) {
          setNotificationCategoryEnabled(cat, nextEnabled, accessToken).catch((error) => {
            console.warn('알림 카테고리 설정을 저장하지 못했습니다:', error)
          })
        }

        return {
          ...prev,
          subscribedCategories: nextEnabled
            ? [...prev.subscribedCategories, cat]
            : prev.subscribedCategories.filter((c) => c !== cat),
        }
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
