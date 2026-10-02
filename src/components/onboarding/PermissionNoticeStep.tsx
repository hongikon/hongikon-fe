import type { ComponentProps } from 'react'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import { RADIUS, SPACING } from '../../constants/spacing'
import { OnboardingPrimaryButton } from './OnboardingButtons'
import { ONBOARDING_TINT } from './OnboardingIllustration'

interface PermissionNoticeStepProps {
  onNext: () => void
}

interface PermissionItem {
  icon: ComponentProps<typeof Ionicons>['name']
  name: string
  reason: string
}

/**
 * 홍익온이 쓰는 접근권한. 모두 선택 권한이고, 해당 기능을 처음 쓸 때 OS 허용 창으로 묻는다.
 * 사진: iOS 는 앨범을 열 때 사진 보관함 권한을 묻고, Android 는 권한 없이 시스템 사진 선택기를 쓴다.
 * 개인정보 처리방침 1항 ④·설정 > 앱 권한(AppPermissionsModal)과 내용을 맞춘다.
 */
const PERMISSIONS: PermissionItem[] = [
  {
    icon: 'notifications-outline',
    name: '알림',
    reason: '로그인하면 구독한 게시판의 새 공지, 내 제보 처리 결과와 캠퍼스 새 제보를 알려 드려요',
  },
  {
    icon: 'camera-outline',
    name: '카메라',
    reason: '제보에 붙일 사진 촬영 — "카메라로 찍기"를 누를 때만 물어봐요',
  },
  ...(Platform.OS === 'ios'
    ? [
        {
          icon: 'images-outline' as const,
          name: '사진',
          reason: '제보에 붙일 사진 선택 — "앨범에서 고르기"를 누를 때만 물어봐요',
        },
      ]
    : []),
]

/**
 * 온보딩 "앱 접근권한 안내"(iOS·Android 만). 정보통신망법 제22조의2·시행령 제9조의2의 앱 최초 실행 시 고지.
 * 필수/선택 구분, 권한별 항목·이유, 선택 권한은 허용하지 않아도 된다는 사실을 알린다.
 * 여기서는 아무 권한도 요청하지 않는다 — 알림은 로그인한 뒤, 카메라·사진은 해당 버튼을 누를 때 묻는다.
 */
export default function PermissionNoticeStep({ onNext }: PermissionNoticeStepProps) {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="shield-checkmark-outline" size={30} color={COLORS.primary} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          앱 접근권한 안내
        </Text>
        <Text style={styles.body}>
          홍익온이 쓰는 권한은 모두 선택 권한이에요.{'\n'}허용하지 않아도 앱을 쓸 수 있고, 해당 기능만 제한돼요.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>선택 접근권한</Text>
          {PERMISSIONS.map((item) => (
            <View key={item.name} style={styles.row} accessible accessibilityLabel={`${item.name}, 선택. ${item.reason}`}>
              <View style={styles.rowIcon}>
                <Ionicons name={item.icon} size={18} color={COLORS.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowName}>
                  {item.name} <Text style={styles.optional}>(선택)</Text>
                </Text>
                <Text style={styles.rowReason}>{item.reason}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.notes}>
          <Text style={styles.note}>· 필수 접근권한은 없어요. 위치·연락처·마이크 권한은 요청하지 않아요.</Text>
          {Platform.OS === 'android' && (
            <Text style={styles.note}>· 제보 사진은 권한 없이 휴대폰의 사진 선택기로 골라요.</Text>
          )}
          <Text style={styles.note}>· 권한은 휴대폰 설정 또는 홍익온 설정 &gt; 앱 권한에서 언제든 바꿀 수 있어요.</Text>
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <OnboardingPrimaryButton label="확인했어요" onPress={onNext} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.xl },
  iconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ONBOARDING_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 24,
    lineHeight: 33,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  body: {
    marginTop: SPACING.md,
    ...TYPE.callout,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  card: {
    marginTop: SPACING.xxl,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.fill,
  },
  cardLabel: { ...TYPE.section, color: COLORS.textSecondary },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: SPACING.xxs },
  rowName: { ...TYPE.subhead, color: COLORS.textPrimary },
  optional: { fontFamily: FONTS.regular, color: COLORS.textTertiary },
  rowReason: { ...TYPE.callout, color: COLORS.textSecondary },
  notes: { marginTop: SPACING.lg, gap: SPACING.xs },
  note: { ...TYPE.caption, color: COLORS.textTertiary },
  bottom: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xs },
})
