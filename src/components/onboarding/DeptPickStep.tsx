import { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import {
  SUBSCRIBABLE_ITEMS,
  groupSubscribableItems,
  type SubscribableItem,
} from '../../constants/news'
import { useSettings } from '../../contexts/SettingsContext'
import { normalize } from '../../utils/normalize'
import SearchBar from '../news/SearchBar'
import { ONBOARDING_TINT } from './OnboardingIllustration'
import { OnboardingPrimaryButton } from './OnboardingButtons'

/** '대학' 묶음(학사·장학 등 학교 전체 게시판 6개). "학교 공지 함께 받기"가 한 번에 켠다. */
const UNIVERSITY_BOARD_IDS: readonly string[] = SUBSCRIBABLE_ITEMS.filter((item) => item.group === '대학').map(
  (item) => item.id,
)

interface DeptPickStepProps {
  /** 고른 게 있든 없든 다음 단계로. 구독은 고르는 즉시 이미 저장돼 있다. */
  onNext: () => void
}

/**
 * "내 학과 고르기". 고르는 즉시 설정(SettingsContext)의 구독 목록에 들어간다 — 구독 관리 모달과 같은 길이라
 * 게스트는 기기에만 두었다가 로그인하면 서버 구독과 합쳐 올라가고, 로그인 상태면 바로 서버로 간다.
 * 아무것도 미리 골라 두지 않는다. 학교 전체 공지는 칩 하나로 한 번에 받을 수 있게만 한다.
 */
export default function DeptPickStep({ onNext }: DeptPickStepProps) {
  const { settings, toggleSubscribedDept } = useSettings()
  const [query, setQuery] = useState('')
  const subscribed = settings.subscribedDepts
  const subscribedSet = useMemo(() => new Set(subscribed), [subscribed])

  const groups = useMemo(() => {
    const keyword = normalize(query)
    const filtered = keyword
      ? SUBSCRIBABLE_ITEMS.filter(
          (item) => normalize(item.name).includes(keyword) || normalize(item.group).includes(keyword),
        )
      : SUBSCRIBABLE_ITEMS
    return groupSubscribableItems(filtered)
  }, [query])

  const universityAllOn = UNIVERSITY_BOARD_IDS.every((id) => subscribedSet.has(id))

  const toggleUniversity = useCallback(() => {
    // 다 켜져 있으면 모두 끄고, 하나라도 꺼져 있으면 꺼진 것만 켠다.
    for (const id of UNIVERSITY_BOARD_IDS) {
      if (universityAllOn || !subscribedSet.has(id)) toggleSubscribedDept(id)
    }
  }, [universityAllOn, subscribedSet, toggleSubscribedDept])

  const count = subscribed.length

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <Text style={styles.title}>어떤 소식을 받아볼까요?</Text>
        <Text style={styles.subtitle}>
          내 학과를 고르면 새 공지를 모아 보여드려요.{'\n'}여러 개 골라도 되고, 나중에 바꿀 수 있어요.
        </Text>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="학과·전공 검색"
          accessibilityLabel="학과 검색"
          style={styles.search}
        />
        <Pressable
          onPress={toggleUniversity}
          style={({ pressed }) => [styles.chip, universityAllOn && styles.chipOn, pressed && styles.pressed]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: universityAllOn }}
          accessibilityLabel="학교 공지(학사·장학 등) 함께 받기"
        >
          <Ionicons
            name={universityAllOn ? 'checkmark-circle' : 'add-circle-outline'}
            size={17}
            color={universityAllOn ? COLORS.white : COLORS.primary}
          />
          <Text style={[styles.chipText, universityAllOn && styles.chipTextOn]}>
            학교 공지(학사·장학 등) 함께 받기
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={32} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>'{query.trim()}'에 맞는 학과가 없어요</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.name} style={styles.group}>
              <Text style={styles.groupTitle}>{group.name}</Text>
              {group.items.map((item) => (
                <DeptRow
                  key={item.id}
                  item={item}
                  selected={subscribedSet.has(item.id)}
                  onToggle={toggleSubscribedDept}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.bottom}>
        {count > 0 ? (
          <OnboardingPrimaryButton label={`${count}개 받아보기`} onPress={onNext} />
        ) : (
          <OnboardingPrimaryButton label="나중에 할게요" tone="soft" onPress={onNext} />
        )}
      </View>
    </View>
  )
}

interface DeptRowProps {
  item: SubscribableItem
  selected: boolean
  onToggle: (id: string) => void
}

const DeptRow = memo(function DeptRow({ item, selected, onToggle }: DeptRowProps) {
  return (
    <Pressable
      onPress={() => onToggle(item.id)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={item.name}
    >
      <Text style={[styles.rowName, selected && styles.rowNameOn]}>{item.name}</Text>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected && <Ionicons name="checkmark" size={15} color={COLORS.white} />}
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: { paddingHorizontal: 20, paddingTop: 8 },
  title: { fontSize: 24, lineHeight: 33, fontFamily: FONTS.bold, color: COLORS.textPrimary, letterSpacing: -0.4 },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 21, fontFamily: FONTS.regular, color: '#6B6B76' },
  search: { marginTop: 20, height: 44, backgroundColor: '#F5F5F7', borderColor: '#F5F5F7' },
  chip: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    backgroundColor: ONBOARDING_TINT,
  },
  chipOn: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
  chipTextOn: { color: COLORS.white },
  pressed: { opacity: 0.75 },
  list: { flex: 1, marginTop: 12 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  group: { marginBottom: 14 },
  groupTitle: {
    fontSize: 12,
    fontFamily: FONTS.semibold,
    color: COLORS.textSecondary,
    marginBottom: 2,
    marginTop: 4,
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowPressed: { backgroundColor: '#F6F6F8' },
  rowName: { flex: 1, marginRight: 12, fontSize: 16, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  rowNameOn: { fontFamily: FONTS.semibold, color: COLORS.primary },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D5D5DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  empty: { paddingVertical: 64, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  bottom: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
})
