import { useState } from 'react'
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// 이용약관 제9조(이용자의 의무)·제10조(이용 제한, 무관용)를 제보에 맞게 풀어 쓴 것. 약관을 바꾸면 함께 고친다.
const RULES = [
  '욕설·비하·혐오 표현, 특정인이나 단체를 비방하는 내용',
  '음란하거나 선정적인 사진·글, 신체 사진',
  '다른 사람의 얼굴·이름·연락처가 드러나는 사진·글',
  '사실이 아닌 정보, 홍보·광고, 같은 내용 반복',
  '남의 사진·글을 허락 없이 올리는 것(초상권·저작권 침해)',
] as const

/**
 * 제보 작성 창의 '제보 시 유의사항'. '제보 올리기' 버튼 바로 위에 접혀 있고, 누르면 펼쳐진다.
 * 무엇을 올리면 안 되는지와 어기면 경고 없이 정지될 수 있다는 것을 올리기 전에 알린다(에브리타임 커뮤니티 이용규칙과 같은 취지).
 */
export default function ReportGuidelines() {
  const [open, setOpen] = useState(false)

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen((value) => !value)
  }

  return (
    <View style={styles.box}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="제보 시 유의사항"
        accessibilityHint={open ? '누르면 접어요' : '누르면 펼쳐서 볼 수 있어요'}
        hitSlop={4}
      >
        <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.danger} />
        <Text style={styles.headText}>제보 시 유의사항</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <Text style={styles.lead}>
            아래 내용이 담긴 제보는 삭제되고, 무관용 원칙에 따라 경고 없이 이용이 정지될 수 있어요.
          </Text>
          {RULES.map((rule) => (
            <View key={rule} style={styles.ruleRow}>
              <Ionicons name="close-circle" size={14} color={COLORS.danger} style={styles.ruleIcon} />
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
          <Text style={styles.foot}>
            정지 이력은 탈퇴한 뒤에도 1년 동안 보관돼요. 자세한 내용은 설정 › 이용약관 제9·10조에서 볼 수 있어요.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 12,
    backgroundColor: COLORS.fill,
    marginBottom: 10,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  pressed: { opacity: 0.6 },
  headText: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  body: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  lead: { fontFamily: FONTS.medium, fontSize: 12.5, lineHeight: 18, color: COLORS.danger, marginBottom: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  ruleIcon: { marginTop: 2 },
  ruleText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18, color: COLORS.textSecondary },
  foot: { fontFamily: FONTS.regular, fontSize: 11.5, lineHeight: 16, color: COLORS.textTertiary, marginTop: 4 },
})
