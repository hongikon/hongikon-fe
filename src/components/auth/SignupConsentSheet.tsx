import { useEffect, useRef, useState } from 'react'
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { TYPE } from '../../constants/typography'
import { SPACING } from '../../constants/spacing'
import { SHEET_MAX_WIDTH } from '../../constants/layout'
import Button from '../common/Button'
import IconButton from '../common/IconButton'
import TermsModal from '../settings/TermsModal'
import PrivacyModal from '../settings/PrivacyModal'
import ConsentCheckRow from './consent/ConsentCheckRow'
import PrivacyProcessingNotice from './consent/PrivacyProcessingNotice'

interface SignupConsentSheetProps {
  visible: boolean
  /** 어떤 계정으로 시작하는지. 개인정보 안내 문구를 그 계정에 맞춘다(null 이면 둘 다 적는다). */
  provider: 'kakao' | 'apple' | null
  /** 모든 항목을 체크하고 "동의하고 시작하기"를 눌렀을 때. 기록·로그인은 부르는 쪽이 한다. */
  onAgree: () => void
  onClose: () => void
  /** 시트가 닫힌 뒤 불린다. 다음 시스템 화면(Apple·카카오 로그인)을 이때 띄운다. */
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

  // 닫히면(보이다가 안 보이게 되면) 바로 onDismiss — 네이티브 창이 아니라 내려가는 애니메이션을 기다릴 것이 없다.
  const wasVisibleRef = useRef(visible)
  useEffect(() => {
    if (wasVisibleRef.current && !visible) onDismiss?.()
    wasVisibleRef.current = visible
  }, [visible, onDismiss])

  // Android 뒤로 가기 = 닫기(예전 Modal 의 onRequestClose).
  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [visible, onClose])

  const allChecked = checked.terms && checked.privacy && checked.age
  const toggle = (key: CheckKey) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  const toggleAll = () => {
    const next = !allChecked
    setChecked({ terms: next, privacy: next, age: next })
  }

  // 네이티브 Modal 을 쓰지 않고 웰컴 화면 위에 덮는 층으로 그린다(10-06). iOS 에서 Modal 이 내려가는 사이에
  // Apple 로그인 창(ASAuthorizationController)이 떠, 로그인 뒤 보이지 않는 Modal 창이 남아 화면 전체가 터치를 받지 않았다.
  if (!visible) return null
  return (
    <View style={StyleSheet.absoluteFill}>
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
            <ConsentCheckRow label="모두 확인하고 동의해요" checked={allChecked} onPress={toggleAll} strong />
            <View style={styles.divider} />

            <ConsentCheckRow
              tag="필수"
              label="이용약관 동의"
              checked={checked.terms}
              onPress={() => toggle('terms')}
              onView={() => setLegal('terms')}
              viewLabel="이용약관 보기"
            />

            <ConsentCheckRow
              tag="필수"
              label="개인정보 처리방침을 확인했어요"
              checked={checked.privacy}
              onPress={() => toggle('privacy')}
              onView={() => setLegal('privacy')}
              viewLabel="개인정보 처리방침 보기"
            />
            <PrivacyProcessingNotice provider={provider} />

            <ConsentCheckRow tag="필수" label="만 14세 이상이에요" checked={checked.age} onPress={() => toggle('age')} />
            <Text style={styles.ageNote}>만 14세 미만은 가입할 수 없어요.</Text>
          </ScrollView>

          <Button label="동의하고 시작하기" onPress={onAgree} disabled={!allChecked} />
        </View>
      </View>

      {/* 약관·처리방침 전문은 시트 위에 겹쳐 뜬다(이 둘은 Modal 이지만 로그인 창을 띄우기 전에 닫힌다). */}
      <TermsModal visible={legal === 'terms'} onClose={() => setLegal(null)} />
      <PrivacyModal visible={legal === 'privacy'} onClose={() => setLegal(null)} />
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
  ageNote: { ...TYPE.caption, color: COLORS.textTertiary, marginLeft: 32 },
})
