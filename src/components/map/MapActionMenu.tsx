import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import ReportMegaphoneIcon from '../common/ReportMegaphoneIcon'
import * as haptics from '../../lib/haptics'

interface MapActionMenuProps {
  onReport: () => void
  /** 넘기지 않으면(길찾기 꺼짐) 항목을 그리지 않는다. */
  onRoute?: () => void
  onRecenter: () => void
  style?: StyleProp<ViewStyle>
}

interface MenuItem {
  key: string
  label: string
  primary?: boolean
  icon: ReactNode
  onPress: () => void
}

/**
 * 지도 오른쪽 아래 접히는 메뉴. 아이콘만 있던 버튼 셋(제보하기·길찾기·캠퍼스로)을
 * 이름표와 함께 펼쳐 보인다. 접기 버튼과 나머지 항목은 하단 탭 바와 같은 맑은 유리(FloatingTabBar pill)이고,
 * 제보하기만 앱의 주 기능이라 메인 컬러로 채워 맨 아래(손에 가까운 쪽)에 둔다(10-18 요청). 항목을 누르면 접힌다.
 */
export default function MapActionMenu({ onReport, onRoute, onRecenter, style }: MapActionMenuProps) {
  const [open, setOpen] = useState(false)
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 160,
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [open, progress])

  const toggle = useCallback(() => {
    haptics.selection()
    setOpen((value) => !value)
  }, [])

  const items: MenuItem[] = [
    {
      key: 'recenter',
      label: '캠퍼스로',
      icon: <Ionicons name="school-outline" size={17} color={COLORS.primary} />,
      onPress: onRecenter,
    },
    ...(onRoute
      ? [{ key: 'route', label: '길찾기', icon: <Ionicons name="navigate" size={17} color={COLORS.primary} />, onPress: onRoute }]
      : []),
    {
      key: 'report',
      label: '제보하기',
      primary: true,
      icon: <ReportMegaphoneIcon size={20} color={COLORS.white} />,
      onPress: onReport,
    },
  ]

  const itemsMotion = {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  }

  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      {open && (
        <Animated.View style={[styles.items, itemsMotion]}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.itemRow}
              activeOpacity={0.8}
              onPress={() => {
                setOpen(false)
                item.onPress()
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={[styles.labelPill, item.primary && styles.labelPillPrimary]}>
                <Text style={[styles.labelText, item.primary && styles.labelTextPrimary]}>{item.label}</Text>
              </View>
              <View style={styles.iconSlot}>
                <View style={[styles.iconBtn, item.primary && styles.iconBtnPrimary]}>{item.icon}</View>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
      <TouchableOpacity
        style={styles.toggle}
        activeOpacity={0.8}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? '지도 메뉴 닫기' : '지도 메뉴 열기(제보하기·캠퍼스로)'}
      >
        <Ionicons name={open ? 'close' : 'menu'} size={20} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  )
}

const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
  elevation: 4,
}

// 하단 탭 바(FloatingTabBar pill)와 같은 맑은 유리. 웹은 흐림 + 위 가장자리 흰 반사광, 네이티브는 흐림이 없어 조금 덜 투명하게.
const glass = {
  backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.7)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 4,
  ...(Platform.OS === 'web'
    ? {
        backdropFilter: 'blur(2px) saturate(160%)',
        boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.7), 0 2px 8px rgba(0,0,0,0.06)',
      }
    : null),
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 10 },
  items: { alignItems: 'flex-end', gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    ...glass,
  },
  labelPillPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary, ...shadow },
  labelText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  labelTextPrimary: { fontFamily: FONTS.bold, color: COLORS.white },
  // 크기가 다른 아이콘 버튼도 접기 버튼(46)과 같은 세로줄 가운데에 오도록 칸 폭을 맞춘다.
  iconSlot: { width: 46, alignItems: 'center' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass,
  },
  iconBtnPrimary: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primary, borderColor: COLORS.primary, ...shadow },
  toggle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass,
  },
})
