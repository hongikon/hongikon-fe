import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import { SHEET_MAX_WIDTH } from '../../constants/layout'
import { RADIUS } from '../../constants/spacing'
import Button from '../common/Button'
import WheelPicker, { type WheelItem } from '../common/WheelPicker'
import { buildFloorOptions, formatFloor } from '../../utils/floors'
import type { Building } from '../../types'

interface FloorDialSheetProps {
  /** null 이면 닫힘. */
  building: Building | null
  role: '출발' | '도착'
  /** 이 건물에서 전에 고른 층. 없으면 1층(없으면 가장 낮은 층). */
  initialFloor: number | null
  onCancel: () => void
  onConfirm: (floor: number) => void
}

/**
 * 길찾기 출발·도착 층을 다이얼로 고르는 아래 시트(11-03). 건물 시트의 출발·도착 버튼이나 길찾기 검색 목록에서
 * 건물을 고르면 뜬다. 위층이 위에 오게 늘어놓는다(엘리베이터 버튼처럼). 층 정보가 없는 건물은 부르지 않는다.
 */
export default function FloorDialSheet(props: FloorDialSheetProps) {
  return (
    <Modal transparent visible={props.building !== null} animationType="fade" onRequestClose={props.onCancel}>
      <SafeAreaProvider>{props.building ? <SheetBody {...props} building={props.building} /> : null}</SafeAreaProvider>
    </Modal>
  )
}

function SheetBody({ building, role, initialFloor, onCancel, onConfirm }: FloorDialSheetProps & { building: Building }) {
  const items = useMemo<WheelItem<number>[]>(
    () => [...buildFloorOptions(building)].reverse().map((option) => ({ value: option.value, label: option.label })),
    [building],
  )
  const fallback = items.some((item) => item.value === 1) ? 1 : (items[items.length - 1]?.value ?? 1)
  const start = initialFloor !== null && items.some((item) => item.value === initialFloor) ? initialFloor : fallback
  const [floor, setFloor] = useState(start)
  useEffect(() => setFloor(start), [start])

  return (
    <View style={styles.backdrop}>
      {/* 바깥을 누르면 취소. 시트를 터치 부품으로 감싸면 휠 스크롤이 자주 안 먹어 시트 뒤에 따로 깐다(ReportTimeSheet 와 같음). */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={`${role} 층 고르기 닫기`}
      />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          {role} 층
        </Text>
        <Text style={styles.preview}>
          {building.name} {formatFloor(floor)}
        </Text>
        <WheelPicker items={items} value={floor} onChange={setFloor} accessibilityLabel={`${building.name} ${role} 층`} />
        <View style={styles.actions}>
          <Button label="취소" variant="secondary" onPress={onCancel} style={styles.action} />
          <Button label={role === '출발' ? '출발로' : '도착으로'} onPress={() => onConfirm(floor)} style={styles.action} />
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 10,
  },
  title: { ...TYPE.headline, color: COLORS.textPrimary, textAlign: 'center' },
  preview: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  action: { flex: 1 },
})
