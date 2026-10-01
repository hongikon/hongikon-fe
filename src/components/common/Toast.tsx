import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { navigationRef } from '../../navigation/navigationRef'

/**
 * 화면 아래에 잠깐 떴다 사라지는 안내(토스트). "구독했어요", "북마크에서 뺐어요"처럼
 * 방금 한 일이 반영됐다는 걸 가볍게 알려줄 때 쓴다. 오류 안내(RetryableError, Alert)는 대신하지 않는다.
 *
 * - 한 번에 하나만 보인다. 새 토스트가 오면 이전 것을 바로 바꾼다.
 * - 기본 2.2초 뒤 사라지고, 되돌리기 같은 버튼이 있으면 누를 시간을 조금 더 준다.
 * - 스크린리더: 뜰 때 문구를 읽어 준다(iOS announce, Android/웹 live region).
 *
 * 네이티브 Modal 은 앱 화면 위에 따로 뜬 창이라 루트에 그린 토스트가 그 아래에 가려진다.
 * 그래서 Modal 안에서 토스트를 띄우려면 그 Modal 안에 `<ToastViewport />` 를 하나 둔다.
 * 마지막에 붙은(가장 위에 있는) 뷰포트 한 곳에만 그려진다.
 */

export type ToastTone = 'success' | 'info' | 'warning'

export interface ToastOptions {
  message: string
  tone?: ToastTone
  /** 오른쪽에 붙는 버튼(예: 되돌리기). 누르면 토스트도 닫힌다. */
  action?: { label: string; onPress: () => void }
  /** ms. 기본 2200, 버튼이 있으면 3500. */
  duration?: number
}

interface ActiveToast extends ToastOptions {
  key: number
}

interface ToastApi {
  show: (options: ToastOptions | string) => void
  hide: () => void
}

interface ToastInternal extends ToastApi {
  toast: ActiveToast | null
  activeHost: number | null
  registerHost: (id: number, isRoot: boolean) => () => void
}

const ToastContext = createContext<ToastInternal | null>(null)

const DEFAULT_DURATION = 2200
const ACTION_DURATION = 3500
/** 탭 화면에서는 하단 탭바(TabNavigator, height 82) 위로 띄운다. */
const ROOT_BOTTOM_OFFSET = 82 + 12
/** 탭바가 없는 화면(소식 상세·검색·학과 소식 등 스택 화면, 웰컴)에서는 홈 인디케이터 바로 위에 둔다. */
const ROOT_BOTTOM_OFFSET_NO_TAB_BAR = 16

/** 지금 맨 위 화면이 탭 화면(Main)인지. 내비게이션 상태가 바뀔 때마다 다시 잰다. */
function isOnTabScreen(): boolean {
  if (!navigationRef.isReady()) return false
  const state = navigationRef.getRootState()
  return state?.routes[state.index]?.name === 'Main'
}

/**
 * 렌더할 때마다 지금 화면을 본다(토스트가 뜰 때마다 Provider 가 다시 그려 준다). 토스트가 떠 있는 사이
 * 화면을 옮겨도 따라가도록 내비게이션 상태 변화에도 다시 그린다.
 */
function useRootBottomOffset(): number {
  const [, rerender] = useState(0)
  useEffect(() => navigationRef.addListener('state', () => rerender((n) => n + 1)), [])
  return isOnTabScreen() ? ROOT_BOTTOM_OFFSET : ROOT_BOTTOM_OFFSET_NO_TAB_BAR
}

let nextHostId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
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

  return (
    <ToastContext.Provider value={value}>
      {children}
      <RootToastViewport />
    </ToastContext.Provider>
  )
}

function RootToastViewport() {
  return <ToastViewport bottomOffset={useRootBottomOffset()} isRoot />
}

/** 토스트 띄우기. Provider 밖(관리자 콘솔 등)에서는 아무 일도 하지 않는다. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  return useMemo(
    () => ({ show: ctx?.show ?? (() => {}), hide: ctx?.hide ?? (() => {}) }),
    [ctx?.show, ctx?.hide],
  )
}

const TONE_ICON: Record<ToastTone, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { name: 'checkmark-circle', color: '#6EE7A8' },
  info: { name: 'information-circle', color: '#A9B8FF' },
  warning: { name: 'alert-circle', color: '#FCD34D' },
}

/**
 * 토스트가 그려지는 자리. 루트에는 Provider 가 하나 두고, Modal 안에서는 직접 하나 둔다.
 * `bottomOffset` 은 홈 인디케이터(safe area) 위로 더 띄울 거리.
 */
export function ToastViewport({
  bottomOffset = 16,
  isRoot = false,
}: {
  bottomOffset?: number
  /** Provider 가 그리는 기본 뷰포트. 직접 쓸 일은 없다. */
  isRoot?: boolean
}) {
  const ctx = useContext(ToastContext)
  const insets = useSafeAreaInsets()
  const idRef = useRef<number>(0)
  if (idRef.current === 0) idRef.current = nextHostId++
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

  if (!ctx || !shown) return null

  const icon = TONE_ICON[shown.tone ?? 'success']
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] })

  return (
    <View style={[styles.layer, { bottom: insets.bottom + bottomOffset }]} pointerEvents="box-none">
      <Animated.View
        style={[styles.toast, { opacity: anim, transform: [{ translateY }] }]}
        accessibilityLiveRegion="polite"
        accessibilityRole={Platform.OS === 'web' ? ('status' as never) : undefined}
      >
        <Ionicons name={icon.name} size={18} color={icon.color} />
        <Text style={styles.message} numberOfLines={2}>
          {shown.message}
        </Text>
        {shown.action && (
          <Pressable
            onPress={() => {
              shown.action?.onPress()
              ctx.hide()
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={shown.action.label}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionText}>{shown.action.label}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 480,
    minHeight: 48,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(25, 25, 32, 0.94)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  message: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 20, color: COLORS.white },
  action: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  actionPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  actionText: { fontFamily: FONTS.semibold, fontSize: 14, color: '#A9B8FF' },
})
