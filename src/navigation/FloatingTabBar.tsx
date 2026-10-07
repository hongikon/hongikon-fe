import { useContext, useEffect, useRef } from 'react'
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import * as haptics from '../lib/haptics'
import { useReduceMotion } from '../hooks/useReduceMotion'

/** 아이콘 크기·칸 너비. 네이버 지도 하단 바처럼 아이콘만 둔 둥근 캡슐. */
const ICON_SIZE = 26
const ITEM_WIDTH = 64
const PILL_HEIGHT = 60
const PILL_PAD = 0
/** 고른 탭 뒤에 깔리는 둥근 영역(유리 렌즈). 양 끝 탭에서도 캡슐 테두리와 위·아래·좌우 간격이 같도록 캡슐 안쪽 여백(PILL_PAD)은 0. */
const LENS_INSET = 6
/** 캡슐 테두리 두께. 렌즈(absolute)는 테두리 안쪽 기준으로 놓이므로 이만큼 빼야 바깥 테두리와 간격이 네 방향 같다. */
const PILL_BORDER = 1
const DIVIDER_WIDTH = 1
const DIVIDER_HEIGHT = 22

/**
 * 화면 아래에 떠 있는 둥근 캡슐 모양 탭 바(아이콘만). 모든 탭에서 내용 위에 겹쳐 뜬다(뒤가 반투명하게 비침, 10-07 요청).
 * 소식·설정 목록은 `useTabBarInset` 만큼 아래 여백을 둬 마지막 항목이 바에 가리지 않는다.
 * 탭 이름은 화면에 쓰지 않고 접근성 이름으로만 읽힌다. 화면이 `tabBarStyle: { display: 'none' }` 이면 숨는다
 * (지도에서 시트를 여는 동안).
 */
export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext)
  const focusedRoute = state.routes[state.index]
  const focusedOptions = descriptors[focusedRoute.key].options
  const hidden = (StyleSheet.flatten(focusedOptions.tabBarStyle) as ViewStyle | undefined)?.display === 'none'

  // 고른 탭 뒤 렌즈가 탭을 바꿀 때 미끄러져 간다(소식 탭 세그먼트와 같은 움직임). 동작 줄이기면 바로 옮긴다.
  const reduceMotion = useReduceMotion()
  const lensX = state.index * ITEM_WIDTH
  const translateX = useRef(new Animated.Value(lensX)).current
  const stretch = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (reduceMotion) {
      translateX.setValue(lensX)
      return
    }
    const useNativeDriver = Platform.OS !== 'web'
    Animated.parallel([
      Animated.spring(translateX, { toValue: lensX, useNativeDriver, damping: 18, stiffness: 220, mass: 0.9 }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1.12, duration: 110, useNativeDriver }),
        Animated.spring(stretch, { toValue: 1, useNativeDriver, damping: 12, stiffness: 260 }),
      ]),
    ]).start()
  }, [lensX, reduceMotion, translateX, stretch])

  if (hidden) return null

  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, 12) + 4 },
      ]}
    >
      <View style={styles.pill} accessibilityRole="tablist">
        <Animated.View pointerEvents="none" style={[styles.lens, { transform: [{ translateX }, { scaleX: stretch }] }]} />
        {/* 아이콘 사이 가는 세로 구분선(소식 탭 세그먼트와 같은 모양). 고른 탭 바로 옆 선은 렌즈와 겹쳐 보여 숨긴다. */}
        {state.routes.slice(1).map((route, i) => (
          <View
            key={`divider-${route.key}`}
            pointerEvents="none"
            style={[
              styles.divider,
              { left: PILL_PAD + (i + 1) * ITEM_WIDTH - DIVIDER_WIDTH / 2 - PILL_BORDER },
              (i === state.index || i + 1 === state.index) && styles.dividerHidden,
            ]}
          />
        ))}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const focused = state.index === index
          const label =
            typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name
          const color = focused ? COLORS.primary : COLORS.textPrimary
          const badge = options.tabBarBadge

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!focused && !event.defaultPrevented) {
              haptics.selection()
              navigation.navigate(route.name, route.params)
            }
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              hitSlop={4}
            >
              {options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
              {badge !== undefined ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{String(badge)}</Text>
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingTop: 8, backgroundColor: 'transparent' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    paddingHorizontal: PILL_PAD,
    borderRadius: PILL_HEIGHT / 2,
    // 뒤 내용이 비치는 유리(10-07 — 투명도를 올렸다). 웹은 흐림까지, 네이티브는 흐림이 없어 조금 덜 투명하게.
    backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
    borderWidth: PILL_BORDER,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    // 웹: 맑은 유리 — 옅은 흰색 + 흐림, 위 가장자리에만 가는 흰 반사광(볼록해 보이지 않게).
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(2px) saturate(160%)',
          boxShadow:
            'inset 0 0.5px 0 rgba(255,255,255,0.7), 0 2px 8px rgba(0,0,0,0.06)',
        }
      : null),
  },
  lens: {
    position: 'absolute',
    top: LENS_INSET - PILL_BORDER,
    left: PILL_PAD + LENS_INSET - PILL_BORDER,
    width: ITEM_WIDTH - LENS_INSET * 2 + PILL_BORDER * 2,
    height: PILL_HEIGHT - LENS_INSET * 2,
    borderRadius: (PILL_HEIGHT - LENS_INSET * 2) / 2,
    // 소식 탭 세그먼트 알약과 같은 반투명 남색 유리(10-08). 웹은 위·아래 가장자리 빛 테와 아주 옅은 그림자를 boxShadow 로 한 번에 그린다.
    backgroundColor: 'rgba(5,1,74,0.17)',
    ...(Platform.OS !== 'web'
      ? {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(255,255,255,0.9)',
          // 그림자를 아래로 밀면 렌즈가 처져 보여 위·아래 간격이 달라 보인다 — 가운데로 고르게, 아주 옅게.
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.08,
          shadowRadius: 3,
        }
      : null),
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(6px) saturate(180%)',
          boxShadow:
            'inset 0 1px 0.5px rgba(255,255,255,0.9), inset 0 -1px 0.5px rgba(255,255,255,0.5), inset 0 0 0 0.5px rgba(5,1,74,0.10), 0 0 4px rgba(5,1,74,0.10)',
        } as ViewStyle)
      : null),
  },
  divider: {
    position: 'absolute',
    top: (PILL_HEIGHT - DIVIDER_HEIGHT) / 2 - PILL_BORDER,
    width: DIVIDER_WIDTH,
    height: DIVIDER_HEIGHT,
    borderRadius: DIVIDER_WIDTH / 2,
    backgroundColor: 'rgba(60,60,67,0.18)',
  },
  dividerHidden: { opacity: 0 },
  item: { width: ITEM_WIDTH, height: PILL_HEIGHT - PILL_BORDER * 2, alignItems: 'center', justifyContent: 'center' },
  itemPressed: { opacity: 0.6 },
  badge: {
    position: 'absolute',
    top: 10,
    right: 12,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: FONTS.semibold, fontSize: 10, color: COLORS.white },
})
