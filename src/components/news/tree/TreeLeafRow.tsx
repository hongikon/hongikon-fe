import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import SubscribeBell from '../../common/SubscribeBell'
import type { TreeChild } from '../../../types'
import { treeRowStyles } from './treeStyles'

interface Props {
  child: TreeChild
  /** 학부 아래 전공 줄이면 한 단계 들여 쓴다. */
  indented?: boolean
  onSelectDept: (id: string, name: string) => void
  subscribed: boolean
  onToggleSubscribe: () => void
}

/** 구독 단위 한 줄. 이름을 누르면 소식 목록, 벨을 누르면 구독 토글. */
export default function TreeLeafRow({ child, indented, onSelectDept, subscribed, onToggleSubscribe }: Props) {
  return (
    <View style={[treeRowStyles.treeChild, indented && styles.treeGrandChild]}>
      <Text style={treeRowStyles.treeChildPrefix}>ㄴ</Text>
      <TouchableOpacity
        style={styles.treeChildTap}
        onPress={() => onSelectDept(child.id, child.name)}
        accessibilityRole="button"
      >
        <Text style={styles.treeChildName}>{child.name}</Text>
        <Ionicons name="chevron-forward" size={14} color={COLORS.chevron} />
      </TouchableOpacity>
      <SubscribeBell name={child.name} subscribed={subscribed} onToggle={onToggleSubscribe} />
    </View>
  )
}

const styles = StyleSheet.create({
  // 학부 아래 전공 줄. 한 단계 더 들어갔다는 걸 들여쓰기와 배경으로 보여준다.
  treeGrandChild: { paddingLeft: 32, backgroundColor: '#FAFAFA' },
  treeChildTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  treeChildName: { fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textPrimary, flex: 1 },
})
