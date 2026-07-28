import { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { SUBSCRIBABLE_ITEMS, type SubscribableItem } from '../../constants/news'
import { FONTS } from '../../constants/typography'

interface SubscriptionManagerModalProps {
  visible: boolean
  onClose: () => void
  subscribedDepts: string[]
  onToggleDept: (id: string) => void
}

interface Group {
  name: string
  items: SubscribableItem[]
}

function buildGroups(items: SubscribableItem[]): Group[] {
  return items.reduce<Group[]>((groups, item) => {
    const last = groups[groups.length - 1]
    if (last && last.name === item.group) {
      last.items.push(item)
      return groups
    }
    return [...groups, { name: item.group, items: [item] }]
  }, [])
}

export default function SubscriptionManagerModal({
  visible,
  onClose,
  subscribedDepts,
  onToggleDept,
}: SubscriptionManagerModalProps) {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
      ? SUBSCRIBABLE_ITEMS.filter(
          (item) =>
            item.name.toLowerCase().includes(keyword) ||
            item.group.toLowerCase().includes(keyword)
        )
      : SUBSCRIBABLE_ITEMS
    return buildGroups(filtered)
  }, [query])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>구독 관리</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text style={styles.done}>완료</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="기관·학과 검색"
            placeholderTextColor={COLORS.textPlaceholder}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {groups.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={36} color="#ddd" />
              <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.name} style={styles.group}>
                <Text style={styles.groupTitle}>{group.name}</Text>
                {group.items.map((item) => {
                  const isOn = subscribedDepts.includes(item.id)
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.row}
                      onPress={() => onToggleDept(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rowName}>{item.name}</Text>
                      <View style={[styles.subBtn, isOn && styles.subBtnOn]}>
                        <Ionicons
                          name={isOn ? 'checkmark' : 'add'}
                          size={14}
                          color={isOn ? COLORS.white : COLORS.primary}
                        />
                        <Text style={[styles.subBtnText, isOn && styles.subBtnTextOn]}>
                          {isOn ? '구독중' : '구독'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  done: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F3F3',
  },
  searchInput: { fontFamily: FONTS.regular, flex: 1, fontSize: 14, color: COLORS.textPrimary, padding: 0 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 14 },
  group: { marginBottom: 18 },
  groupTitle: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.textTertiary,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f4f4f4',
  },
  rowName: { fontFamily: FONTS.regular, flex: 1, fontSize: 14, color: COLORS.textPrimary, marginRight: 12 },
  subBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  subBtnOn: { backgroundColor: COLORS.primary },
  subBtnText: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.primary },
  subBtnTextOn: { color: COLORS.white },
  empty: { height: 260, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: '#ccc' },
  bottomSpacer: { height: 24 },
})
