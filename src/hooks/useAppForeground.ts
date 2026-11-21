import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

/** 앱이 화면에 떠 있는지(AppState 'active'). 내리면 false. */
export function useAppForeground(): boolean {
  const [foreground, setForeground] = useState(AppState.currentState === 'active')
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'))
    return () => subscription.remove()
  }, [])
  return foreground
}
