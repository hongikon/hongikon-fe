import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import ReportMegaphoneIcon from '../common/ReportMegaphoneIcon'
import FlameIcon from '../common/FlameIcon'
import { reportCategoryMeta } from '../../constants/reportCategories'
import type { ReportCategory } from '../../types'
import * as haptics from '../../lib/haptics'

interface MapActionMenuProps {
  onReport: () => void
  /** 넘기지 않으면(길찾기 꺼짐) 항목을 그리지 않는다. */
  onRoute?: () => void
  onRecenter: () => void
  /** 제보 보기(종류·HOT). 위쪽 칩 줄에서 옮겨 왔다(10-27). */
  reportFilter: ReportFilterProps
  /**
   * 펼친 항목이 쓸 수 있는 최대 높이(검색바·칩 아래부터 접기 버튼 위까지). 넘치면 항목만 스크롤한다 —
   * 작은 화면에서 제보 종류까지 펼치면 위 항목이 검색바 밑으로 잘렸다(10-27).
   */
  maxItemsHeight?: number
  style?: StyleProp<ViewStyle>
}

/** 제보는 지도에 늘 켜 둔다(10-27) — 끄는 스위치 없이 종류·HOT 만 고른다. */
export interface ReportFilterProps {
  /** 칩으로 그릴 종류(순서대로). */
  categories: readonly ReportCategory[]
  /** 지금 보이는 종류. 모두 들어 있으면 거르지 않는다. */
  selected: ReadonlySet<ReportCategory>
  onToggleCategory: (category: ReportCategory) => void
  hotOn: boolean
  /** 서버가 🔥 를 모르면 HOT 칩을 그리지 않는다. */
  hotAvailable: boolean
  onToggleHot: () => void
}

/** 전부 보는 기본 상태가 아니면(일부 종류·HOT 만) 메뉴 버튼에 점을 찍는다 — 닫힌 메뉴만 봐도 걸러 보는 중인 걸 알게. */
function isNarrowed(filter: ReportFilterProps): boolean {
  return filter.hotOn || filter.categories.some((key) => !filter.selected.has(key))
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
export default function MapActionMenu({ onReport, onRoute, onRecenter, reportFilter, maxItemsHeight, style }: MapActionMenuProps) {
  const [open, setOpen] = useState(false)
  /** '제보 보기'를 눌러 종류 줄을 펼쳤는지. 메뉴를 닫으면 다시 접는다. */
  const [filterOpen, setFilterOpen] = useState(false)
  const progress = useRef(new Animated.Value(0)).current
  const scrollRef = useRef<ScrollView>(null)

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
    setFilterOpen(false)
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
        <Animated.View style={itemsMotion}>
          {/* 넘치면 스크롤. 펼치거나 줄이 늘면 손에 가까운 맨 아래(제보하기)가 보이게 끝으로 내린다. */}
          <ScrollView
            ref={scrollRef}
            style={maxItemsHeight !== undefined ? { maxHeight: maxItemsHeight } : null}
            contentContainerStyle={styles.items}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
          {/* 제보 종류 줄. '제보 보기'를 누르면 그 위로 펼친다. 메뉴 항목과 같은 '이름표 + 동그란 아이콘' 줄이고,
              켜짐은 아이콘을 채우고 꺼짐은 비운다(10-27). 눌러도 메뉴를 접지 않는다 — 여러 종류를 이어서 켜고 끄게. */}
          {filterOpen && reportFilter.categories.map((key) => {
            const meta = reportCategoryMeta(key)
            const active = reportFilter.selected.has(key)
            return (
              <FilterRow
                key={key}
                label={meta.label}
                active={active}
                accessibilityLabel={`${meta.label} 제보`}
                onPress={() => reportFilter.onToggleCategory(key)}
                icon={<Ionicons name={meta.icon} size={17} color={active ? COLORS.white : COLORS.textTertiary} />}
              />
            )
          })}
          {filterOpen && reportFilter.hotAvailable && (
            <FilterRow
              label="HOT만"
              active={reportFilter.hotOn}
              accessibilityLabel="HOT 제보만 보기"
              onPress={reportFilter.onToggleHot}
              icon={<FlameIcon variant={reportFilter.hotOn ? 'hot' : 'outline'} size={17} />}
            />
          )}
          {filterOpen && <View style={styles.divider} />}
          <TouchableOpacity
            style={styles.itemRow}
            activeOpacity={0.8}
            onPress={() => {
              haptics.selection()
              setFilterOpen((value) => !value)
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: filterOpen }}
            accessibilityLabel="제보 보기"
          >
            <View style={styles.labelPill}>
              <Text style={styles.labelText}>제보 보기</Text>
            </View>
            <View style={styles.iconSlot}>
              <View style={[styles.iconBtn, filterOpen && styles.iconBtnOn]}>
                <Ionicons name="options-outline" size={18} color={filterOpen ? COLORS.white : COLORS.primary} />
              </View>
              {/* 닫힌 상태에서도 걸러 보는 중이면 이 항목에 점을 찍어 어디서 바꿨는지 보이게 한다. */}
              {!filterOpen && isNarrowed(reportFilter) && <View style={styles.itemDot} />}
            </View>
          </TouchableOpacity>
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
          </ScrollView>
        </Animated.View>
      )}
      <TouchableOpacity
        style={styles.toggle}
        activeOpacity={0.8}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? '지도 메뉴 닫기' : '지도 메뉴 열기(제보 보기·제보하기·캠퍼스로)'}
      >
        <Ionicons name={open ? 'close' : 'menu'} size={20} color={COLORS.primary} />
        {!open && isNarrowed(reportFilter) && <View style={styles.narrowedDot} />}
      </TouchableOpacity>
    </View>
  )
}

/** 메뉴 안 제보 종류 한 줄(체크 칸처럼 켜고 끈다). */
function FilterRow({
  label,
  active,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label: string
  active: boolean
  icon: ReactNode
  onPress: () => void
  accessibilityLabel: string
}) {
  return (
    <TouchableOpacity
      style={styles.itemRow}
      activeOpacity={0.8}
      onPress={() => {
        haptics.selection()
        onPress()
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.labelPill}>
        <Text style={[styles.labelText, !active && styles.labelTextOff]}>{label}</Text>
      </View>
      <View style={styles.iconSlot}>
        <View style={[styles.iconBtn, active && styles.iconBtnOn]}>{icon}</View>
      </View>
    </TouchableOpacity>
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
  // 스크롤 칸이 그림자를 자르지 않게 둘레를 조금 띄운다.
  items: { alignItems: 'flex-end', gap: 10, paddingTop: 6, paddingBottom: 2, paddingLeft: 8 },
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
  labelTextOff: { color: COLORS.textTertiary },
  iconBtnOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  // 펼친 제보 종류 줄과 '제보 보기' 사이 가름줄. 아이콘 칸 폭에 맞춘다.
  divider: { width: 46, height: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(0,0,0,0.18)', marginVertical: 2 },
  itemDot: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  narrowedDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  toggle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass,
  },
})
