import { useCallback, useState, type Ref } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { KEYBOARD_DISMISS_MODE, layoutStyles } from '../../constants/layout'
import { FONTS } from '../../constants/typography'
import type { TreeNode } from '../../types'
import EmptyState from '../common/EmptyState'
import { useTabBarInset } from '../../hooks/useTabBarInset'
import { RADIUS } from '../../constants/spacing'
import SubscribeBell from '../common/SubscribeBell'
import TreeLeafRow from './tree/TreeLeafRow'
import TreeSubGroup from './tree/TreeSubGroup'

interface DeptTreeListProps {
  /** 검색어. 검색 중이 아니면 빈 문자열. */
  query: string
  /** 보여줄 트리. 검색 중이 아니면 원본 전체(훑어보기)를 그대로 넣는다. */
  results: TreeNode[]
  /** 검색 중인지. 검색 중일 때는 결과를 펼친 채로 보여준다. */
  isSearching: boolean
  onSelectDept: (id: string, name: string) => void
  subscribedDepts: string[]
  onToggleSubscribe: (id: string) => void
  /** 탭을 다시 누르면 맨 위로 올리기(useScrollToTop) 같은 데 쓰는 스크롤 ref. */
  scrollRef?: Ref<ScrollView>
  /** 손을 뗄 때(검색 화면이 맨 위에서 끌어내려 닫기에 쓴다). */
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

/**
 * 학과·기관 트리 목록.
 *
 * 검색 결과 목록으로도, 훑어보는 목록으로도 쓴다 — 검색어가 비어 있으면
 * `results`에 원본 트리 전체를 그대로 넣으면 된다(hooks/useTreeSearch.ts 규약).
 */
export default function DeptTreeList({
  query,
  results,
  isSearching,
  onSelectDept,
  subscribedDepts,
  onToggleSubscribe,
  scrollRef,
  onScrollEndDrag,
}: DeptTreeListProps) {
  const tabInset = useTabBarInset()
  // 펼침 상태는 이름으로 기억한다. 검색으로 목록이 걸러지면 순서가 밀려서
  // 인덱스로 기억하면 엉뚱한 단과대가 펼쳐진다.
  // 처음에는 전부 접어 둔다. 단과대가 많아 하나가 펼쳐져 있으면 나머지가 아래로 밀린다.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleNode = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  if (results.length === 0) {
    return (
      <View style={styles.treeScroll}>
        <EmptyState icon="search-outline" message={`'${query.trim()}' 검색 결과가 없어요`} />
      </View>
    )
  }

  return (
    <ScrollView
      ref={scrollRef}
      onScrollEndDrag={onScrollEndDrag}
      style={styles.treeScroll}
      contentContainerStyle={[styles.treeContent, layoutStyles.readable, tabInset > 0 && { paddingBottom: tabInset + 12 }]}
      keyboardShouldPersistTaps="handled"
      // 학과 검색 키보드도 목록을 아래로 끌면 내려간다(소식 목록과 같게).
      keyboardDismissMode={KEYBOARD_DISMISS_MODE}
    >
      {results.map((node) => {
        const isLeaf = node.children.length === 0
        // 검색 중에는 걸린 결과가 바로 보이도록 모두 펼친다.
        const isOpen = isSearching || expanded.has(node.name)

        return (
          <View key={node.name} style={styles.treeCard}>
            <TouchableOpacity
              style={styles.treeParent}
              onPress={() =>
                isLeaf ? onSelectDept(node.name, node.name) : toggleNode(node.name)
              }
              accessibilityRole="button"
              accessibilityState={isLeaf ? undefined : { expanded: isOpen }}
            >
              <Text style={styles.treeParentName}>{node.name}</Text>
              {isLeaf ? (
                <SubscribeBell
                  name={node.name}
                  subscribed={subscribedDepts.includes(node.name)}
                  onToggle={() => onToggleSubscribe(node.name)}
                />
              ) : (
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={COLORS.textTertiary}
                />
              )}
            </TouchableOpacity>

            {!isLeaf && isOpen && (
              <View style={styles.treeChildren}>
                {node.children.map((child) =>
                  child.children?.length ? (
                    <TreeSubGroup
                      key={child.id}
                      group={child}
                      forceOpen={isSearching}
                      onSelectDept={onSelectDept}
                      subscribedDepts={subscribedDepts}
                      onToggleSubscribe={onToggleSubscribe}
                    />
                  ) : (
                    <TreeLeafRow
                      key={child.id}
                      child={child}
                      onSelectDept={onSelectDept}
                      subscribed={subscribedDepts.includes(child.id)}
                      onToggleSubscribe={() => onToggleSubscribe(child.id)}
                    />
                  )
                )}
              </View>
            )}
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  treeScroll: { flex: 1, backgroundColor: COLORS.background },
  treeContent: { padding: 12, gap: 8 },
  treeCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden' },
  treeParent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  treeParentName: { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  treeChildren: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.divider },
  // 하위 줄(학과·학부 묶음) 모양은 tree/treeStyles.ts, tree/TreeLeafRow.tsx, tree/TreeSubGroup.tsx 에 있다.
})
