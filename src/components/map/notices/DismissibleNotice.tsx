import { memo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { noticeStyles } from './noticeStyles'
import { useDismissibleNotice } from '../../../hooks/map/notices/useDismissibleNotice'

export interface Props {
  message: string
  /** `onPress` 가 있을 때 문구 끝에 붙는 행동 이름(예: '보기'). */
  actionLabel?: string
  onPress?: () => void
  dismissed: ReadonlySet<string>
  onDismiss: (message: string) => void
}

/**
 * [닫을 수 있는 안내 줄] 끝의 X 를 누르면 닫힌다. `onPress` 가 없으면 줄 어디를 눌러도 닫히고,
 * 있으면(예: 지도에 안 보이는 업체 보기) 줄을 누를 때 그 동작을 한다. 이미 닫은 문구면 그리지 않는다.
 */
function DismissibleNotice({ message, actionLabel, onPress, dismissed, onDismiss }: Props) {
  const { dismiss } = useDismissibleNotice({ message, onDismiss })
  if (dismissed.has(message)) return null
  return (
    <Pressable
      onPress={onPress ?? dismiss}
      style={({ pressed }) => [noticeStyles.pill, pressed && noticeStyles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={onPress ? `${message}. ${actionLabel ?? '열기'}` : `${message}. 탭하면 닫혀요`}
    >
      <Ionicons name="information-circle" size={13} color={COLORS.textSecondary} />
      <Text style={[noticeStyles.text, styles.text]} numberOfLines={1}>
        {message}
      </Text>
      {onPress && actionLabel && <Text style={noticeStyles.action}>{actionLabel}</Text>}
      <Pressable
        onPress={dismiss}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="안내 닫기"
      >
        <Ionicons name="close" size={14} color={COLORS.textSecondary} />
      </Pressable>
    </Pressable>
  )
}

export default memo(DismissibleNotice)

const styles = StyleSheet.create({
  text: { flex: 1 },
})
