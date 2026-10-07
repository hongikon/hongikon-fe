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
 * 화면 아래에 떠 있는 둥근 캡슐 모양 탭 바(아이콘만). 지도 탭에서는 지도 위에 떠 있고(뒤가 비침),
 * 소식·설정 탭에서는 흰 바탕 위에 같은 캡슐을 둔다(내용이 바 뒤로 숨지 않게 자리를 차지한다).
 * 탭 이름은 화면에 쓰지 않고 접근성 이름으로만 읽힌다. 화면이 `tabBarStyle: { display: 'none' }` 이면 숨는다
 * (지도에서 시트를 여는 동안).
 */
export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext)
  const focusedRoute = state.routes[state.index]
  const focusedOptions = descriptors[focusedRoute.key].options
  const hidden = (StyleSheet.flatten(focusedOptions.tabBarStyle) as ViewStyle | undefined)?.display === 'none'
  // 지도 탭은 지도 위에 띄운다(뒤 지도가 보이게). 다른 탭은 자리를 차지한다.
  const floating = focusedRoute.name === 'Map'

  if (hidden) return null

  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[
        styles.wrap,
        floating ? styles.wrapFloating : styles.wrapSolid,
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
  wrap: { alignItems: 'center', paddingTop: 8 },
  wrapFloating: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
  wrapSolid: { backgroundColor: COLORS.white },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    paddingHorizontal: 10,
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : null),
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
