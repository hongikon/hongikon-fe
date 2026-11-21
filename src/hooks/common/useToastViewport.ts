import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Animated, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ToastContext, allocateHostId, type ActiveToast } from '../../utils/common/toast'

/** ToastViewport 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useToastViewport({ isRoot = false }: Pick<{
  bottomOffset?: number
  /** Provider 가 그리는 기본 뷰포트. 직접 쓸 일은 없다. */
  isRoot?: boolean
}, 'isRoot'>) {
  const ctx = useContext(ToastContext)
  const insets = useSafeAreaInsets()
  const idRef = useRef<number>(0)
  if (idRef.current === 0) idRef.current = allocateHostId()
  const registerHost = ctx?.registerHost

  useLayoutEffect(() => registerHost?.(idRef.current, isRoot), [registerHost, isRoot])

  const isActive = ctx?.activeHost === idRef.current
  const toast = isActive ? ctx?.toast ?? null : null

  // 사라질 때도 애니메이션을 보여주려고 마지막 토스트를 잠깐 들고 있는다.
  const [shown, setShown] = useState<ActiveToast | null>(null)
  const anim = useRef(new Animated.Value(0)).current
  const useNativeDriver = Platform.OS !== 'web'

  useEffect(() => {
    if (toast) {
      setShown(toast)
      anim.setValue(0)
      Animated.spring(anim, { toValue: 1, useNativeDriver, speed: 18, bounciness: 5 }).start()
      return
    }
    Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver }).start(({ finished }) => {
      if (finished) setShown(null)
    })
  }, [toast, anim, useNativeDriver])
  return { ctx, insets, shown, anim }
}
