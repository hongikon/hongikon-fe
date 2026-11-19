import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { TYPE } from '../../../constants/typography'
import { RADIUS, SPACING } from '../../../constants/spacing'
import ReportMegaphoneIcon from '../../common/ReportMegaphoneIcon'

interface Props {
  authenticated: boolean
  /** 보여 줄 닉네임. 아직 못 받았으면 undefined('불러오는 중'). */
  displayName: string | undefined
  /** 게스트는 로그인하러, 로그인은 닉네임 변경 창. 누를 게 없으면 undefined. */
  onPress: (() => void) | undefined
}

/** 프로필 줄. 사진 올리기는 아직 없어 모두 같은 기본 프로필(앱 아이콘 — 남색 원 안 흰 확성기)을 쓴다(10-07). */
export default function ProfileCard({ authenticated, displayName, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.profile, pressed && styles.profilePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={authenticated ? `프로필 ${displayName ?? ''}, 닉네임 변경` : '로그인하기'}
    >
      <View style={styles.avatar}>
        <ReportMegaphoneIcon size={24} color={COLORS.white} />
      </View>
      <View style={styles.profileBody}>
        <Text style={styles.profileName} numberOfLines={1}>
          {authenticated ? (displayName ?? '불러오는 중') : '게스트'}
        </Text>
        <Text style={styles.profileSub} numberOfLines={1}>
          {authenticated ? '홍익대학교 · 닉네임 변경' : '로그인하고 닉네임을 정해 보세요'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.floating,
    backgroundColor: COLORS.background,
  },
  profilePressed: { opacity: 0.7 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBody: { flex: 1, gap: 2 },
  profileName: { ...TYPE.subhead, color: COLORS.textPrimary },
  profileSub: { ...TYPE.caption, color: COLORS.textSecondary },
})
