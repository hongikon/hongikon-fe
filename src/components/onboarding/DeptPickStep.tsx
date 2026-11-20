import { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { useSettings } from '../../contexts/SettingsContext'
import { filterSubscribableGroups, universityAllSubscribed, universityToggleIds } from '../../utils/news/deptPick'
import SearchBar from '../news/SearchBar'
import { OnboardingPrimaryButton } from './OnboardingButtons'
import DeptRow from './dept/DeptRow'
import UniversityNoticeChip from './dept/UniversityNoticeChip'

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

  const groups = useMemo(() => filterSubscribableGroups(query), [query])

  const universityAllOn = universityAllSubscribed(subscribedSet)

  const toggleUniversity = useCallback(() => {
    // 다 켜져 있으면 모두 끄고, 하나라도 꺼져 있으면 꺼진 것만 켠다.
    for (const id of universityToggleIds(subscribedSet)) toggleSubscribedDept(id)
  }, [subscribedSet, toggleSubscribedDept])

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
        <UniversityNoticeChip allOn={universityAllOn} onToggle={toggleUniversity} />
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: { paddingHorizontal: 20, paddingTop: 8 },
  title: { fontSize: 24, lineHeight: 33, fontFamily: FONTS.bold, color: COLORS.textPrimary, letterSpacing: -0.4 },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 21, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  search: { marginTop: 20 },
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
