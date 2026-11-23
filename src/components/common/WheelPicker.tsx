import { View, Text, ScrollView, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import { useWheelPicker } from '../../hooks/common/useWheelPicker'
import { WHEEL_ITEM_HEIGHT, IS_WEB, DEFAULT_VISIBLE_ROWS, type WheelItem } from '../../utils/common/wheelPicker'

export interface WheelPickerProps<T> {
  items: readonly WheelItem<T>[]
  value: T
  onChange: (value: T) => void
  /** 화면 읽기 프로그램이 읽는 이름(예: '시작 날짜'). */
  accessibilityLabel: string
  /** 한 번에 보이는 칸 수(홀수). 기본 5. 폼 안에 바로 넣는 작은 다이얼은 3. */
  visibleRows?: number
  style?: StyleProp<ViewStyle>
}

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
  const { padRows, scrollRef, selectedIndex, centerIndex, lastY, dragging, userScroll, programmatic, initialOffset, scrollToIndex, commit, clearSettle, settleNow, scheduleSettle, handleScroll, handleAccessibilityAction, webKeyProps } = useWheelPicker<T>({ items, value, onChange, visibleRows })

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
          userScroll.current = true
          programmatic.current = null
          clearSettle()
        }}
        onScrollEndDrag={(event) => {
          dragging.current = false
          lastY.current = event.nativeEvent.contentOffset.y
          // 관성·스냅 없이 그 자리에 멈췄으면 멈춤 이벤트가 안 온다 — 잠깐 기다렸다 맞춘다.
          // 관성이 이어지면(onMomentumScrollBegin) 이 타이머를 지우고 멈춤 이벤트에서 확정한다. 웹은 뒤 스크롤 이벤트가 미룬다.
          scheduleSettle()
        }}
        onMomentumScrollBegin={() => {
          if (!IS_WEB) clearSettle()
        }}
        onMomentumScrollEnd={(event) => {
          // 코드로 돌린 애니메이션이 끝나도 이 이벤트가 온다 — 사용자가 돌린 것만 값으로 받는다.
          if (!userScroll.current || dragging.current) return
          lastY.current = event.nativeEvent.contentOffset.y
          settleNow()
        }}
        contentOffset={initialOffset}
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
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },
  item: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  label: { fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textSecondary },
  labelCentered: { fontFamily: FONTS.semibold, fontSize: 17, color: COLORS.primary },
  labelFar: { opacity: 0.45 },
  labelDisabled: { color: COLORS.iconMuted },
})
