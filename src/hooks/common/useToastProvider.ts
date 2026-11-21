import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'
import { ACTION_DURATION, DEFAULT_DURATION, type ActiveToast, type ToastOptions, type ToastInternal } from '../../utils/common/toast'

/** ToastProvider 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useToastProvider() {
  const [toast, setToast] = useState<ActiveToast | null>(null)
  const [hosts, setHosts] = useState<number[]>([])
  const keyRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const hide = useCallback(() => {
    clearTimer()
    setToast(null)
  }, [])

  const show = useCallback(
    (input: ToastOptions | string) => {
      const options: ToastOptions = typeof input === 'string' ? { message: input } : input
      clearTimer()
      keyRef.current += 1
      setToast({ tone: 'success', ...options, key: keyRef.current })
      const duration = options.duration ?? (options.action ? ACTION_DURATION : DEFAULT_DURATION)
      timerRef.current = setTimeout(() => setToast(null), duration)
      // iOS VoiceOver 는 live region 이 없어 직접 읽어 준다.
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(options.message)
    },
    [],
  )

  useEffect(() => clearTimer, [])

  // 루트 뷰포트는 늘 맨 아래(맨 앞)에 둔다. 마운트 순서와 관계없이 Modal 안 뷰포트가 우선한다.
  const registerHost = useCallback((id: number, isRoot: boolean) => {
    setHosts((prev) => (isRoot ? [id, ...prev] : [...prev, id]))
    return () => setHosts((prev) => prev.filter((h) => h !== id))
  }, [])

  const value = useMemo<ToastInternal>(
    () => ({ show, hide, toast, activeHost: hosts.length ? hosts[hosts.length - 1] : null, registerHost }),
    [show, hide, toast, hosts, registerHost],
  )
  return { value }
}
