import { Pressable, StyleSheet, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { SELECTED_PILL_BG } from '../../common/Chip'

interface Props {
  /** 학교 공지 게시판이 모두 켜져 있는지. */
  allOn: boolean
  onToggle: () => void
}

/** ["학교 공지 함께 받기" 칩] 학사·장학 등 학교 전체 게시판을 한 번에 켜고 끈다. */
export default function UniversityNoticeChip({ allOn, onToggle }: Props) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.chip, allOn && styles.chipOn, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: allOn }}
      // react-native-web 0.21 은 accessibilityState 를 DOM 에 옮기지 않아 웹은 aria-* 로 따로 준다.
      aria-checked={allOn}
      accessibilityLabel="학교 공지(학사·장학 등) 함께 받기"
    >
      <Ionicons
        name={allOn ? 'checkmark-circle' : 'add-circle-outline'}
        size={17}
        color={allOn ? COLORS.primary : COLORS.textSecondary}
      />
      <Text style={[styles.chipText, allOn && styles.chipTextOn]} numberOfLines={1}>
        학교 공지(학사·장학 등) 함께 받기
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    marginTop: 12,
    alignSelf: 'flex-start',
    // 폴드 커버(≈344dp)처럼 좁은 화면에서 글자가 칩 밖으로 넘치지 않게 줄 너비에서 멈춘다.
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  // 켜짐: 회색 알약 + 남색 글자·체크(10-08, 앱 전체 선택 표시와 같게). 꺼짐은 흰 바탕 + 회색 글자.
  chipOn: { backgroundColor: SELECTED_PILL_BG, borderColor: 'transparent' },
  chipText: { flexShrink: 1, fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  chipTextOn: { color: COLORS.primary },
  pressed: { opacity: 0.75 },
})
