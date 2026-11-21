import { useContext, useMemo, type ReactNode } from 'react'
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import { useToastProvider } from '../../hooks/common/useToastProvider'
import { useToastViewport } from '../../hooks/common/useToastViewport'
import { ToastContext, type ToastTone, type ToastApi } from '../../utils/common/toast'
import { useRootBottomOffset } from '../../hooks/common/useRootBottomOffset'

export function ToastProvider({ children }: { children: ReactNode }) {
  const { value } = useToastProvider()

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
  const { ctx, insets, shown, anim } = useToastViewport({ isRoot })

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
    borderRadius: RADIUS.floating,
    backgroundColor: 'rgba(25, 25, 32, 0.94)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  message: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 20, color: COLORS.white },
  action: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.md },
  actionPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  actionText: { fontFamily: FONTS.semibold, fontSize: 14, color: '#A9B8FF' },
})
