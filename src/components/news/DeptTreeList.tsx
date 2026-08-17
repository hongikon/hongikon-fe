import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import type { TreeChild, TreeNode } from '../../types'

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
}

/** 학과 옆 구독 벨. 행 탭(소식 보기)과 분리해 벨만 구독을 토글한다. */
function SubscribeBell({
  subscribed,
  onToggle,
}: {
  subscribed: boolean
  onToggle: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.bell, subscribed && styles.bellOn]}
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={subscribed ? '구독 해제' : '구독'}
    >
      <Ionicons
        name={subscribed ? 'notifications' : 'notifications-outline'}
        size={15}
        color={subscribed ? COLORS.white : '#c0c0c0'}
      />
    </TouchableOpacity>
  )
}

/** 구독 단위 한 줄. 이름을 누르면 소식 목록, 벨을 누르면 구독 토글. */
function TreeLeafRow({
  child,
  indented,
  onSelectDept,
  subscribed,
  onToggleSubscribe,
}: {
  child: TreeChild
  indented?: boolean
  onSelectDept: (id: string, name: string) => void
  subscribed: boolean
  onToggleSubscribe: () => void
}) {
  return (
    <View style={[styles.treeChild, indented && styles.treeGrandChild]}>
      <Text style={styles.treeChildPrefix}>ㄴ</Text>
      <TouchableOpacity
        style={styles.treeChildTap}
        onPress={() => onSelectDept(child.id, child.name)}
      >
        <Text style={styles.treeChildName}>{child.name}</Text>
        <Ionicons name="chevron-forward" size={12} color="#ddd" />
      </TouchableOpacity>
      <SubscribeBell subscribed={subscribed} onToggle={onToggleSubscribe} />
    </View>
  )
}

/**
 * 전공이 나뉜 학부처럼 한 단계 더 들어가는 묶음.
 * 이 줄 자체는 구독 단위가 아니라서 벨 대신 펼치기 화살표만 둔다.
 */
function TreeSubGroup({
  group,
  forceOpen,
  onSelectDept,
  subscribedDepts,
  onToggleSubscribe,
}: {
  group: TreeChild
  /** 검색 중에는 결과가 접혀 있으면 안 되므로 강제로 펼친다. */
  forceOpen?: boolean
  onSelectDept: (id: string, name: string) => void
  subscribedDepts: string[]
  onToggleSubscribe: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const isOpen = forceOpen || open

  return (
    <View>
      <TouchableOpacity
        style={styles.treeChild}
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <Text style={styles.treeChildPrefix}>ㄴ</Text>
        <Text style={styles.treeSubGroupName}>{group.name}</Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={13} color="#bbb" />
      </TouchableOpacity>

      {isOpen &&
        group.children?.map((child) => (
          <TreeLeafRow
            key={child.id}
            child={child}
            indented
            onSelectDept={onSelectDept}
            subscribed={subscribedDepts.includes(child.id)}
            onToggleSubscribe={() => onToggleSubscribe(child.id)}
          />
        ))}
    </View>
  )
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
}: DeptTreeListProps) {
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
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={40} color="#ddd" />
          <Text style={styles.emptyText}>'{query.trim()}' 검색 결과가 없습니다</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.treeScroll}
      contentContainerStyle={styles.treeContent}
      keyboardShouldPersistTaps="handled"
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
            >
              <Text style={styles.treeParentName}>{node.name}</Text>
              {isLeaf ? (
                <SubscribeBell
                  subscribed={subscribedDepts.includes(node.name)}
                  onToggle={() => onToggleSubscribe(node.name)}
                />
              ) : (
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color="#bbb"
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
  treeContent: { padding: 10, gap: 6 },
  treeCard: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden' },
  treeParent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
  },
  treeParentName: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  treeChildren: { borderTopWidth: 0.5, borderTopColor: '#f2f2f2' },
  treeChild: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 0.5,
    borderTopColor: '#f8f8f8',
    gap: 7,
  },
  // 학부 아래 전공 줄. 한 단계 더 들어갔다는 걸 들여쓰기와 배경으로 보여준다.
  treeGrandChild: { paddingLeft: 30, backgroundColor: '#fbfbfd' },
  treeSubGroupName: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: '#444' },
  treeChildTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  treeChildPrefix: { fontFamily: FONTS.regular, fontSize: 12, color: '#c8c8c8', width: 14 },
  treeChildName: { fontFamily: FONTS.regular, fontSize: 13, color: '#444', flex: 1 },
  bell: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1.2,
    borderColor: '#e2e2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  emptyState: { height: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: '#ccc' },
})
