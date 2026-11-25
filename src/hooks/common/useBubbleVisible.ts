import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useGlassLens } from './useGlassLens'

export type Lens = ReturnType<typeof useGlassLens>

/** 웹에서만 lift 값을 지켜보며 방울이 떠 있는지(> 0.001) 알려 준다. 네이티브는 늘 true(그림자는 불투명도 0 이면 안 보인다). */
export function useBubbleVisible(lens: Lens) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const id = lens.lift.addListener(({ value }) => setVisible(value > 0.001))
    return () => lens.lift.removeListener(id)
  }, [lens.lift])
  return Platform.OS !== 'web' || visible
}
