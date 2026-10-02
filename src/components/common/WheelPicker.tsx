import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import * as haptics from '../../lib/haptics'

export interface WheelItem<T> {
  value: T
  label: string
  /** 고를 수 없는 값(지난 시각 등). 흐리게 보이고, 멈추면 가장 가까운 고를 수 있는 칸으로 옮겨 간다. */
  disabled?: boolean
}

interface WheelPickerProps<T> {
  items: readonly WheelItem<T>[]
  value: T
  onChange: (value: T) => void
  /** 화면 읽기 프로그램이 읽는 이름(예: '시작 날짜'). */
  accessibilityLabel: string
  /** 한 번에 보이는 칸 수(홀수). 기본 5. 폼 안에 바로 넣는 작은 다이얼은 3. */
  visibleRows?: number
  style?: StyleProp<ViewStyle>
}

export const WHEEL_ITEM_HEIGHT = 44
const DEFAULT_VISIBLE_ROWS = 5
/** 스크롤이 이만큼(ms) 멈춰 있으면 가장 가까운 칸에 맞춘다. 웹은 스냅 이벤트가 없어 이걸로 맞춘다. */
const SETTLE_DELAY_MS = 120

/**
 * iOS 식 다이얼(돌려서 고르는 휠). 네이티브 모듈 없이 ScrollView 로만 만들어 OTA·웹에서도 그대로 돈다.
 *
 * - 칸 높이 44, 5칸(visibleRows)이 보이고 가운데 띠에 든 칸이 고른 값이다.
 * - 손을 떼고 멈추면 가장 가까운 칸에 붙는다(네이티브는 snapToInterval, 웹은 멈춘 뒤 scrollTo).
 *   막힌 칸(disabled)에 멈추면 가장 가까운 고를 수 있는 칸으로 옮긴다.
 * - 값이 바뀔 때 짧은 선택 햅틱.
 * - 접근성: adjustable — 화면 읽기 프로그램에서 위·아래로 쓸어 값을 바꾼다(increment/decrement).
 * - 웹: 마우스 휠로 돌리고, 포커스한 뒤 ↑↓ 키로 한 칸씩 옮긴다. 칸을 눌러도 고른다.
 */
export default function WheelPicker<T>({
  items,
  value,
  onChange,
  accessibilityLabel,
  visibleRows = DEFAULT_VISIBLE_ROWS,
  style,
}: WheelPickerProps<T>) {
  const padRows = Math.max(0, Math.floor((visibleRows - 1) / 2))
  const scrollRef = useRef<ScrollView>(null)
  const selectedIndex = Math.max(0, items.findIndex((item) => item.value === value))
  /** 스크롤 중 가운데에 든 칸(강조용). 멈추면 selectedIndex 와 같아진다. */
  const [centerIndex, setCenterIndex] = useState(selectedIndex)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastY = useRef(selectedIndex * WHEEL_ITEM_HEIGHT)
  const dragging = useRef(false)
  /**
   * 코드로 돌리는 중인 목표 위치. 그 사이 오는 스크롤 이벤트는 사용자가 돌린 게 아니라 값으로 받지 않는다
   * (애니메이션 중간 칸이 값으로 들어가는 것을 막는다).
   */
  const programmatic = useRef<{ y: number; until: number } | null>(null)
  // 늦게 도는 타이머가 옛 값·옛 콜백을 쓰지 않게 최신 값을 ref 로 들고 있는다.
  const latest = useRef({ items, value, onChange })
  latest.current = { items, value, onChange }

  const nearestEnabled = (list: readonly WheelItem<T>[], index: number): number => {
    const clamped = Math.min(Math.max(index, 0), list.length - 1)
    if (!list[clamped]?.disabled) return clamped
    for (let distance = 1; distance < list.length; distance += 1) {
      if (list[clamped + distance] && !list[clamped + distance].disabled) return clamped + distance
      if (list[clamped - distance] && !list[clamped - distance].disabled) return clamped - distance
    }
    return clamped
  }

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    const y = index * WHEEL_ITEM_HEIGHT
    if (Math.abs(lastY.current - y) <= 1) return
    programmatic.current = { y, until: Date.now() + 600 }
    lastY.current = y
    scrollRef.current?.scrollTo({ y, animated })
  }, [])

  /** index 칸을 고른다(막혔으면 가장 가까운 칸). 값이 바뀌면 onChange + 햅틱. */
  const commit = (index: number) => {
    const { items: list, value: current, onChange: change } = latest.current
    const target = nearestEnabled(list, index)
    setCenterIndex(target)
    scrollToIndex(target, true)
    const item = list[target]
    if (item && item.value !== current && !item.disabled) {
      haptics.selection()
      change(item.value)
    }
  }
  const commitRef = useRef(commit)
  commitRef.current = commit

  // 바깥에서 값이 바뀌면(다른 열 때문에 맞춰짐 등) 그 칸으로 돌린다.
  useEffect(() => {
    if (dragging.current) return
    setCenterIndex(selectedIndex)
    scrollToIndex(selectedIndex, true)
  }, [selectedIndex, scrollToIndex])

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current)
    },
    [],
  )

  const scheduleSettle = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      if (dragging.current) return
      commitRef.current(Math.round(lastY.current / WHEEL_ITEM_HEIGHT))
    }, SETTLE_DELAY_MS)
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y
    const index = Math.min(Math.max(Math.round(y / WHEEL_ITEM_HEIGHT), 0), items.length - 1)
    if (index !== centerIndex) setCenterIndex(index)
    const target = programmatic.current
    if (target && !dragging.current) {
      // 코드로 돌리는 중 — 도착했거나 시간이 지나면 끝낸다. 값은 commit 이 이미 정했다.
      if (Math.abs(y - target.y) <= 1 || Date.now() > target.until) programmatic.current = null
      return
    }
    programmatic.current = null
    lastY.current = y
    scheduleSettle()
  }

  /** 막힌 칸은 건너뛰고 한 칸 옮긴다. */
  const step = (direction: 1 | -1) => {
    for (let index = selectedIndex + direction; index >= 0 && index < items.length; index += direction) {
      if (!items[index].disabled) {
        commit(index)
        return
      }
    }
  }

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') step(1)
    if (event.nativeEvent.actionName === 'decrement') step(-1)
  }

  // react-native-web 은 View 에 onKeyDown 을 넘겨준다(RN 타입엔 없음).
  const webKeyProps =
    Platform.OS === 'web'
      ? {
          onKeyDown: (event: { key: string; preventDefault: () => void }) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              step(1)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              step(-1)
            }
          },
        }
      : {}

  return (
    <View
      style={[styles.wheel, { height: WHEEL_ITEM_HEIGHT * (padRows * 2 + 1) }, style]}
      accessible
      focusable
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: items[selectedIndex]?.label ?? '' }}
      aria-valuetext={items[selectedIndex]?.label ?? ''}
      accessibilityActions={[
        { name: 'increment', label: '다음 값' },
        { name: 'decrement', label: '이전 값' },
      ]}
      onAccessibilityAction={handleAccessibilityAction}
      {...webKeyProps}
    >
      <View style={[styles.band, { top: WHEEL_ITEM_HEIGHT * padRows }]} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        // 세로로 스크롤되는 폼 안에 넣어도(제보 작성의 층 다이얼) Android 에서 다이얼이 먼저 돌게 한다.
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          dragging.current = true
          programmatic.current = null
        }}
        onScrollEndDrag={() => {
          dragging.current = false
          // 관성 없이 멈췄으면 더 오는 스크롤 이벤트가 없다 — 여기서 맞춘다(관성이 있으면 뒤 이벤트가 미룬다).
          scheduleSettle()
        }}
        onMomentumScrollEnd={(event) => {
          if (programmatic.current) return
          dragging.current = false
          lastY.current = event.nativeEvent.contentOffset.y
          scheduleSettle()
        }}
        contentOffset={{ x: 0, y: selectedIndex * WHEEL_ITEM_HEIGHT }}
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM_HEIGHT * padRows }}
        // 처음 그릴 때 고른 칸으로 맞춘다(웹은 contentOffset 을 무시한다).
        onLayout={() => {
          lastY.current = -1
          scrollToIndex(selectedIndex, false)
        }}
        importantForAccessibility="no-hide-descendants"
      >
        {items.map((item, index) => {
          const centered = index === centerIndex
          return (
            <Pressable
              key={String(item.value)}
              style={styles.item}
              onPress={() => !item.disabled && commit(index)}
              disabled={item.disabled}
              accessible={false}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  centered && styles.labelCentered,
                  item.disabled && styles.labelDisabled,
                  !centered && Math.abs(index - centerIndex) >= 2 && styles.labelFar,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wheel: { overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: 2,
    right: 2,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
  },
  item: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  label: { fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textSecondary },
  labelCentered: { fontFamily: FONTS.semibold, fontSize: 17, color: COLORS.primary },
  labelFar: { opacity: 0.45 },
  labelDisabled: { color: COLORS.iconMuted },
})
