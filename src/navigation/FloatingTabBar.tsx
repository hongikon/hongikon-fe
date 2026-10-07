import { useContext } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import * as haptics from '../lib/haptics'

/** 아이콘 크기·칸 너비. 네이버 지도 하단 바처럼 아이콘만 둔 둥근 캡슐. */
const ICON_SIZE = 26
const ITEM_WIDTH = 64
const PILL_HEIGHT = 60

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
    paddingHorizontal: 10,
    borderRadius: PILL_HEIGHT / 2,
    // 뒤 내용이 살짝 비치는 반투명 흰색(웹은 흐림까지). 네이티브는 흐림이 없어 조금 더 불투명하게.
    backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px) saturate(180%)' } : null),
  },
  item: { width: ITEM_WIDTH, height: PILL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
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
