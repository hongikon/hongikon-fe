import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import { RADIUS, SPACING } from '../../constants/spacing'
import { SHEET_MAX_WIDTH } from '../../constants/layout'
import Button from '../common/Button'
import IconButton from '../common/IconButton'
import TermsModal from '../settings/TermsModal'
import PrivacyModal from '../settings/PrivacyModal'

interface SignupConsentSheetProps {
  visible: boolean
  /** 어떤 계정으로 시작하는지. 개인정보 안내 문구를 그 계정에 맞춘다(null 이면 둘 다 적는다). */
  provider: 'kakao' | 'apple' | null
  /** 모든 항목을 체크하고 "동의하고 시작하기"를 눌렀을 때. 기록·로그인은 부르는 쪽이 한다. */
  onAgree: () => void
  onClose: () => void
  /** iOS: 시트가 완전히 내려간 뒤 불린다(Modal onDismiss). 다음 시스템 화면(Apple·카카오 로그인)을 이때 띄운다. */
  onDismiss?: () => void
}

type CheckKey = 'terms' | 'privacy' | 'age'

/**
 * 첫 로그인(가입) 직전의 약관 동의 시트(store-submission-kit §3-1, F1).
 *
 * - 이용약관: 계약이라 동의(체크)를 받는다.
 * - 개인정보: 서비스 이용 계약 이행에 필요한 정보만 처리하므로(개인정보 보호법 제15조 제1항 제4호, 2023.9. 개정)
 *   "동의"가 아니라 처리 "안내"다. 처리방침을 읽었다는 확인만 받는다.
 * - 만 14세 이상: 14세 미만은 가입할 수 없다는 안내를 본인이 확인한다(연령 확인 수단은 아니다).
 *
 * 선택 동의 항목은 없다. 나중에 광고성 알림 등 동의 기반 처리를 더하면 선택 항목과 14세 미만 법정대리인 동의가 필요해진다.
 */
export default function SignupConsentSheet({ visible, provider, onAgree, onClose, onDismiss }: SignupConsentSheetProps) {
  const insets = useSafeAreaInsets()
  const [checked, setChecked] = useState<Record<CheckKey, boolean>>({ terms: false, privacy: false, age: false })
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null)

  // 열 때마다 처음부터 체크하게 한다(다른 사람이 쓰던 기기에서 체크가 남아 있지 않게).
  useEffect(() => {
    if (visible) setChecked({ terms: false, privacy: false, age: false })
  }, [visible])

  const allChecked = checked.terms && checked.privacy && checked.age
  const toggle = (key: CheckKey) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  const toggleAll = () => {
    const next = !allChecked
    setChecked({ terms: next, privacy: next, age: next })
  }

  const accountInfo =
    provider === 'apple'
      ? 'Apple 사용자 식별자와 공유한 경우 이름'
      : provider === 'kakao'
        ? '카카오 회원번호와 닉네임'
        : '카카오 회원번호·닉네임(Apple 로그인은 사용자 식별자, 공유한 경우 이름)'

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              홍익온 시작하기
            </Text>
            <IconButton icon="close" size={20} color={COLORS.textTertiary} onPress={onClose} accessibilityLabel="닫기" />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} bounces={false}>
            <CheckRow label="모두 확인하고 동의해요" checked={allChecked} onPress={toggleAll} strong />
            <View style={styles.divider} />

            <CheckRow
              tag="필수"
              label="이용약관 동의"
              checked={checked.terms}
              onPress={() => toggle('terms')}
              onView={() => setLegal('terms')}
              viewLabel="이용약관 보기"
            />

            <CheckRow
              tag="필수"
              label="개인정보 처리방침을 확인했어요"
              checked={checked.privacy}
              onPress={() => toggle('privacy')}
              onView={() => setLegal('privacy')}
              viewLabel="개인정보 처리방침 보기"
            />
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>개인정보 처리 안내</Text>
              <Text style={styles.noticeText}>
                · 회원 식별·로그인 유지: {accountInfo}. 탈퇴하면 바로 지워요.
              </Text>
              <Text style={styles.noticeText}>
                · 직접 올리는 정보: 앱 닉네임, 제보(사진·위치·내용)와 댓글, 문의 내용과 남긴 연락처.
              </Text>
              <Text style={styles.noticeText}>
                · 알림을 켜면: 알림을 보낼 기기 정보(푸시 토큰).
              </Text>
              <Text style={styles.noticeText}>
                · 알림·앱 업데이트·웹 화면 등 일부 정보는 미국의 서비스(Expo·Apple·Google·Netlify)를 거쳐 처리돼요.
              </Text>
              <Text style={styles.noticeText}>
                · 서비스 제공에 꼭 필요한 정보만 처리해 따로 동의를 받지 않아요. 자세한 내용은 처리방침에 있어요.
              </Text>
            </View>

            <CheckRow tag="필수" label="만 14세 이상이에요" checked={checked.age} onPress={() => toggle('age')} />
            <Text style={styles.ageNote}>만 14세 미만은 가입할 수 없어요.</Text>
          </ScrollView>

          <Button label="동의하고 시작하기" onPress={onAgree} disabled={!allChecked} />
        </View>
      </View>

      {/* 시트(Modal) 안에서 연 약관·처리방침 전문은 시트 위에 겹쳐 뜬다. */}
      <TermsModal visible={legal === 'terms'} onClose={() => setLegal(null)} />
      <PrivacyModal visible={legal === 'privacy'} onClose={() => setLegal(null)} />
    </Modal>
  )
}

function CheckRow({
  tag,
  label,
  checked,
  onPress,
  onView,
  viewLabel,
  strong = false,
}: {
  tag?: string
  label: string
  checked: boolean
  onPress: () => void
  onView?: () => void
  viewLabel?: string
  strong?: boolean
}) {
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
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: COLORS.scrim },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    maxHeight: '88%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  title: { ...TYPE.headline, color: COLORS.textPrimary },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: SPACING.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  rowLabel: { flex: 1, ...TYPE.body, color: COLORS.textPrimary },
  rowLabelStrong: { fontFamily: FONTS.semibold },
  tag: { fontFamily: FONTS.semibold, color: COLORS.primary },
  view: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  viewText: { ...TYPE.callout, fontFamily: FONTS.medium, color: COLORS.textSecondary, textDecorationLine: 'underline' },
  notice: {
    marginLeft: 32,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    gap: SPACING.xxs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.fill,
  },
  noticeTitle: { ...TYPE.label, color: COLORS.textSecondary, marginBottom: SPACING.xxs },
  noticeText: { ...TYPE.caption, color: COLORS.textSecondary },
  ageNote: { ...TYPE.caption, color: COLORS.textTertiary, marginLeft: 32 },
  pressed: { opacity: 0.6 },
})
