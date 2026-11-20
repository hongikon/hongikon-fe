import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import type { TreeChild } from '../../../types'
import TreeLeafRow from './TreeLeafRow'
import { treeRowStyles } from './treeStyles'

interface Props {
  group: TreeChild
  /** 검색 중에는 결과가 접혀 있으면 안 되므로 강제로 펼친다. */
  forceOpen?: boolean
  onSelectDept: (id: string, name: string) => void
  subscribedDepts: string[]
  onToggleSubscribe: (id: string) => void
}

/**
 * 전공이 나뉜 학부처럼 한 단계 더 들어가는 묶음.
 * 이 줄 자체는 구독 단위가 아니라서 벨 대신 펼치기 화살표만 둔다.
 */
export default function TreeSubGroup({ group, forceOpen, onSelectDept, subscribedDepts, onToggleSubscribe }: Props) {
  const [open, setOpen] = useState(false)
  const isOpen = forceOpen || open

  return (
    <View>
      <TouchableOpacity
        style={treeRowStyles.treeChild}
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <Text style={treeRowStyles.treeChildPrefix}>ㄴ</Text>
        <Text style={styles.treeSubGroupName}>{group.name}</Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
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

const styles = StyleSheet.create({
  treeSubGroupName: { flex: 1, fontFamily: FONTS.medium, fontSize: 16, color: COLORS.textPrimary },
})
