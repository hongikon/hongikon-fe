import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CategoryKey } from '../constants/colors'

const STORAGE_KEY = '@hongik_settings'

interface Settings {
  subscriptionAlert: boolean
  favoriteBuildings: string[]
  subscribedCategories: CategoryKey[]
}

interface SettingsContextValue {
  settings: Settings
  toggleSubscriptionAlert: () => void
  toggleFavoriteBuilding: (name: string) => void
  toggleSubscribedCategory: (cat: CategoryKey) => void
  resetSettings: () => void
}

export const ALL_CATEGORIES: CategoryKey[] = ['공지', '장학', '행사', '수강', '시설', '취업', '상담']

const DEFAULT_SETTINGS: Settings = {
  subscriptionAlert: true,
  favoriteBuildings: [],
  subscribedCategories: ALL_CATEGORIES,
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<Settings>
          setSettings((prev) => ({ ...prev, ...parsed }))
        } catch {}
      }
      setLoaded(true)
    })
  }, [])

  const persist = useCallback((next: Settings) => {
    setSettings(next)
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const toggleSubscriptionAlert = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, subscriptionAlert: !prev.subscriptionAlert }
      persist(next)
      return next
    })
  }, [persist])

  const toggleFavoriteBuilding = useCallback((name: string) => {
    setSettings((prev) => {
      const exists = prev.favoriteBuildings.includes(name)
      const favoriteBuildings = exists
        ? prev.favoriteBuildings.filter((b) => b !== name)
        : [...prev.favoriteBuildings, name]
      const next = { ...prev, favoriteBuildings }
      persist(next)
      return next
    })
  }, [persist])

  const toggleSubscribedCategory = useCallback((cat: CategoryKey) => {
    setSettings((prev) => {
      const exists = prev.subscribedCategories.includes(cat)
      const subscribedCategories = exists
        ? prev.subscribedCategories.filter((c) => c !== cat)
        : [...prev.subscribedCategories, cat]
      const next = { ...prev, subscribedCategories }
      persist(next)
      return next
    })
  }, [persist])

  const resetSettings = useCallback(() => {
    persist(DEFAULT_SETTINGS)
  }, [persist])

  if (!loaded) return null

  return (
    <SettingsContext.Provider
      value={{
        settings,
        toggleSubscriptionAlert,
        toggleFavoriteBuilding,
        toggleSubscribedCategory,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
