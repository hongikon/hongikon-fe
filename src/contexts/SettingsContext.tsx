import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@hongik_settings'

type MapType = '일반' | '위성' | '지형'

interface Settings {
  subscriptionAlert: boolean
  mapType: MapType
  favoriteBuildings: string[]
}

interface SettingsContextValue {
  settings: Settings
  toggleSubscriptionAlert: () => void
  setMapType: (type: MapType) => void
  toggleFavoriteBuilding: (name: string) => void
  resetSettings: () => void
}

const DEFAULT_SETTINGS: Settings = {
  subscriptionAlert: true,
  mapType: '일반',
  favoriteBuildings: [],
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

  const setMapType = useCallback((type: MapType) => {
    setSettings((prev) => {
      const next = { ...prev, mapType: type }
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

  const resetSettings = useCallback(() => {
    persist(DEFAULT_SETTINGS)
  }, [persist])

  if (!loaded) return null

  return (
    <SettingsContext.Provider
      value={{
        settings,
        toggleSubscriptionAlert,
        setMapType,
        toggleFavoriteBuilding,
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
