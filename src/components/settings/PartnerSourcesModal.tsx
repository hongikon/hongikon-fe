import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { RADIUS, SPACING } from '../../constants/spacing'
import { FONTS } from '../../constants/typography'
import { PARTNER_SOURCES } from '../../constants/partnerSources'
import { PARTNER_NOTICE_TEXT } from '../map/PartnerNoticeModal'
import ModalHeader from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import { openExternalUrl } from '../../utils/openExternalUrl'

interface PartnerSourcesModalProps {
  visible: boolean
  onClose: () => void
}

export default function PartnerSourcesModal({ visible, onClose }: PartnerSourcesModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
        <ContentColumn>
        <ModalHeader title="제휴 출처" onClose={onClose} />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.intro}>{PARTNER_NOTICE_TEXT}</Text>
          {PARTNER_SOURCES.map((source) => (
            <View key={source.affiliation} style={styles.card}>
              <Text style={styles.affiliation}>{source.affiliation}</Text>
              {source.period && <Text style={styles.period}>제휴기간 {source.period}</Text>}
              {source.links.map((link) => (
                <TouchableOpacity
                  key={link.url}
                  style={styles.linkRow}
                  onPress={() => openExternalUrl(link.url)}
                  accessibilityRole="link"
                >
                  <Ionicons name="link-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.linkText} numberOfLines={1}>
                    {link.label}
                  </Text>
                  <Ionicons name="open-outline" size={14} color={COLORS.chevron} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
        </ContentColumn>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  // 회색 바탕 위 둥근 흰 카드(설정 탭 묶음 카드와 같은 여백·곡률, 10-07).
  body: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 40 },
  intro: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginBottom: 16,
    // 카드 안 글자(28)와 같은 들여쓰기(10-08).
    paddingHorizontal: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    padding: 16,
    marginBottom: SPACING.sm,
  },
  affiliation: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  period: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  linkText: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.primary },
})
