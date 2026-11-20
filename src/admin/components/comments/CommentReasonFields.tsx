import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { MODERATION_REASONS } from '../../utils/commentModeration'

/** 숨김·삭제 사유 최대 길이(서버 제한과 같다). */
const REASON_MAX_LENGTH = 200

interface Props {
  reason: string
  onChangeReason: (reason: string) => void
  busy: boolean
  app: boolean
}

/** 숨김·삭제 확인 막대 안의 사유 고르기(칩) + 직접 적기. 작성자 알림에 그대로 들어간다. */
export function CommentReasonFields({ reason, onChangeReason, busy, app }: Props) {
  return (
    <>
      <View style={styles.reasonChips} accessibilityRole="radiogroup" accessibilityLabel="사유 고르기">
        {MODERATION_REASONS.map((label) => {
          const selected = reason === label
          return (
            <Pressable
              key={label}
              onPress={() => onChangeReason(selected ? '' : label)}
              disabled={busy}
              style={[styles.reasonChip, selected && styles.reasonChipOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              hitSlop={4}
            >
              <Text style={[styles.reasonChipText, selected && styles.reasonChipTextOn]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
      <TextInput
        value={reason}
        onChangeText={onChangeReason}
        placeholder="직접 적기(선택) · 비우면 가장 많은 신고 사유로 알려요"
        placeholderTextColor={COLORS.textPlaceholder}
        maxLength={REASON_MAX_LENGTH}
        style={[styles.reasonInput, app && styles.reasonInputApp]}
        editable={!busy}
        multiline={app}
        returnKeyType="done"
        submitBehavior={app ? 'blurAndSubmit' : undefined}
        accessibilityLabel="숨김·삭제 사유"
      />
      <Text style={styles.counter}>
        작성자에게 그대로 보입니다. 신고자나 개인정보는 적지 마세요. {reason.length}/{REASON_MAX_LENGTH}
      </Text>
    </>
  )
}

const styles = StyleSheet.create({
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  reasonChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  reasonChipText: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.textSecondary },
  reasonChipTextOn: { color: COLORS.white },
  reasonInput: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reasonInputApp: { minHeight: 72, fontSize: 15, textAlignVertical: 'top', paddingVertical: 10 },
  counter: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textSecondary },
})
