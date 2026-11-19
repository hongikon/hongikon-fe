import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS, TYPE } from '../../../constants/typography'
import { SPACING } from '../../../constants/spacing'

interface Props {
  /** 앞에 붙는 꼬리표(예: 필수). */
  tag?: string
  label: string
  checked: boolean
  onPress: () => void
  /** 전문 보기. 있으면 오른쪽에 '보기' 링크를 둔다. */
  onView?: () => void
  viewLabel?: string
  /** '모두 동의' 줄처럼 굵게. */
  strong?: boolean
}

/** [동의 체크 줄] 동그란 체크와 글자, 필요하면 오른쪽 '보기'(약관·처리방침 전문). */
export default function ConsentCheckRow({ tag, label, checked, onPress, onView, viewLabel, strong = false }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={tag ? `${tag}, ${label}` : label}
        hitSlop={{ top: 4, bottom: 4 }}
      >
        <Ionicons
          name={checked ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={checked ? COLORS.primary : COLORS.iconMuted}
        />
        <Text style={[styles.rowLabel, strong && styles.rowLabelStrong]}>
          {tag && <Text style={styles.tag}>[{tag}] </Text>}
          {label}
        </Text>
      </Pressable>
      {onView && (
        <Pressable
          onPress={onView}
          hitSlop={8}
          style={({ pressed }) => [styles.view, pressed && styles.pressed]}
          accessibilityRole="link"
          accessibilityLabel={viewLabel}
        >
          <Text style={styles.viewText}>보기</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  rowLabel: { flex: 1, ...TYPE.body, color: COLORS.textPrimary },
  rowLabelStrong: { fontFamily: FONTS.semibold },
  tag: { fontFamily: FONTS.semibold, color: COLORS.primary },
  view: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  viewText: { ...TYPE.callout, fontFamily: FONTS.medium, color: COLORS.textSecondary, textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
})
