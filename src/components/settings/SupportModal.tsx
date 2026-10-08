import { useState } from 'react'
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { RADIUS, SPACING } from '../../constants/spacing'
import { FONTS, TYPE } from '../../constants/typography'
import { REPORT_FLAG_REASONS } from '../../constants/report'
import { notify } from '../../utils/dialog'
import { openSitePage } from '../../utils/openSitePage'
import ModalHeader from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import ListRow from '../common/ListRow'
import WithdrawConfirmDialog from './WithdrawConfirmDialog'
import SectionTitle from '../common/SectionTitle'

/** 처리방침·약관·hongikon.com/support/ 에 적힌 것과 같은 주소. */
export const SUPPORT_EMAIL = 'hongikonsupport@gmail.com'

interface Faq {
  q: string
  a: string
}

// 답은 앱이 실제로 그렇게 동작하는 것만 적는다(설정 화면·제보 시트 문구와 맞춤). 웹 /support/ 와 내용이 같다.
const FAQS: readonly Faq[] = [
  {
    q: '부적절한 제보를 신고하고 싶어요',
    a: `지도에서 제보를 누른 뒤 ⋮ › 신고하기에서 사유(${REPORT_FLAG_REASONS.map((r) => r.label).join(', ')})를 고르면 운영진에게 전달돼요. 신고된 제보는 24시간 안에 확인해 조치하는 것을 원칙으로 해요.`,
  },
  {
    q: '특정 사용자의 제보를 보고 싶지 않아요',
    a: '제보를 누른 뒤 ⋮ › 이 사용자 숨기기를 누르면 그 사용자의 제보가 더는 보이지 않아요. 설정 › 숨긴 사용자에서 다시 볼 수 있어요.',
  },
  {
    q: '알림이 오지 않아요',
    a: '휴대폰 설정에서 홍익온 알림이 켜져 있는지 먼저 확인해 주세요. 앱 안에서는 설정 › 알림에서 알림 설정과 알림 받을 분야, 게시판별 알림이 켜져 있어야 해요. 알림은 로그인한 뒤에 받을 수 있어요.',
  },
  {
    q: '학교 공지는 어디서 가져오나요?',
    a: '학교·학과 홈페이지에 공개된 공지 목록을 한 시간에 한 번 읽어 와 원문 링크와 함께 보여 줘요. 내용이 원문과 다르면 원문이 맞아요.',
  },
  {
    q: '회원 탈퇴는 어떻게 하나요?',
    a: '로그인한 상태에서 설정 › 일반의 설정 초기화 아래 회원 탈퇴를 누르고, 확인 창에서 예, 탈퇴할게요를 누르면 바로 처리돼요. 카카오·Apple 계정과의 연결도 해제돼요.',
  },
]

interface SupportModalProps {
  visible: boolean
  onClose: () => void
  /** '앱에서 문의 보내기' — 설정 화면이 이 창을 닫고 문의하기 창을 연다. */
  onOpenFeedback: () => void
  /** 로그인한 회원인지. 게스트는 지울 계정이 없어 '계정 삭제 안내'가 웹 안내 페이지를 연다. */
  isMember: boolean
  /** 탈퇴 확인 창에서 '예'를 눌렀을 때(설정 화면의 탈퇴 처리). */
  onWithdraw: () => Promise<void>
}

/**
 * 설정 › 고객 지원. 문의 방법(앱 문의·이메일), 자주 묻는 질문, 웹 안내 페이지를 한곳에 모은다.
 * App Store 지원 URL(hongikon.com/support/)과 같은 내용을 앱 안에서도 볼 수 있게 한다.
 */
export default function SupportModal({ visible, onClose, onOpenFeedback, isMember, onWithdraw }: SupportModalProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  // 이 창 위에 떠야 해서(iOS 는 모달 위에 다른 모달을 띄우려면 그 안에 있어야 한다) 탈퇴 확인 창을 여기 둔다.
  const [withdrawVisible, setWithdrawVisible] = useState(false)

  const openEmail = () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[홍익온] 문의')}`
    // 메일 앱이 없는 기기(시뮬레이터, 메일 계정 없는 폰)에서는 주소를 보여 준다.
    Linking.openURL(url).catch(() => notify('이메일로 문의하기', `${SUPPORT_EMAIL} 로 보내 주세요.`))
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ContentColumn>
            <ModalHeader title="고객 지원" onClose={onClose} />
            <ScrollView contentContainerStyle={styles.body}>
              <View style={styles.hero}>
                <Text style={styles.heroTitle}>무엇을 도와드릴까요?</Text>
                <Text style={styles.heroText}>
                  보내 주신 문의는 영업일 기준 2일 안에 답변하는 것을 목표로 해요. 앱에서 보낼 때는 답장 받을 이메일을 함께 적어 주세요.
                </Text>
              </View>

              <View style={styles.section}>
                <SectionTitle title="문의하기" />
                <ListRow
                  icon="chatbubble-ellipses-outline"
                  label="앱에서 문의 보내기"
                  value="로그인 없이도 돼요"
                  onPress={onOpenFeedback}
                />
                <ListRow icon="mail-outline" label="이메일로 문의하기" value={SUPPORT_EMAIL} last onPress={openEmail} />
              </View>

              <View style={styles.section}>
                <SectionTitle title="자주 묻는 질문" />
                {FAQS.map((faq, index) => {
                  const open = openIndex === index
                  return (
                    <View key={faq.q} style={[styles.faq, index === FAQS.length - 1 && styles.faqLast]}>
                      <Pressable
                        onPress={() => setOpenIndex(open ? null : index)}
                        style={({ pressed }) => [styles.faqHead, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                      >
                        <Text style={styles.faqQ}>{faq.q}</Text>
                        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.chevron} />
                      </Pressable>
                      {open ? <Text style={styles.faqA}>{faq.a}</Text> : null}
                    </View>
                  )
                })}
              </View>

              <View style={styles.section}>
                <SectionTitle title="더 보기" />
                <ListRow
                  icon="globe-outline"
                  label="웹 고객 지원 페이지"
                  value="hongikon.com/support"
                  onPress={() => openSitePage('/support/')}
                />
                <ListRow
                  icon="trash-outline"
                  label="계정 삭제 안내"
                  danger
                  last
                  onPress={() => (isMember ? setWithdrawVisible(true) : openSitePage('/account-deletion/'))}
                />
              </View>
            </ScrollView>
          </ContentColumn>
          <WithdrawConfirmDialog
            visible={withdrawVisible}
            onCancel={() => setWithdrawVisible(false)}
            onConfirm={async () => {
              await onWithdraw()
              setWithdrawVisible(false)
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  // 좌우 여백·곡률은 설정 탭 묶음 카드와 같다(10-07).
  body: { paddingTop: SPACING.sm, paddingBottom: 40 },
  hero: {
    backgroundColor: COLORS.primarySoft,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.floating,
    padding: 16,
    gap: 6,
  },
  heroTitle: { ...TYPE.headline, color: COLORS.primary },
  heroText: { ...TYPE.callout, color: COLORS.textSecondary },
  section: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.floating,
    overflow: 'hidden',
  },
  faq: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider, paddingHorizontal: 16 },
  faqLast: { borderBottomWidth: 0 },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  pressed: { opacity: 0.6 },
  faqQ: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textPrimary },
  faqA: { ...TYPE.callout, color: COLORS.textSecondary, paddingBottom: 14 },
})
