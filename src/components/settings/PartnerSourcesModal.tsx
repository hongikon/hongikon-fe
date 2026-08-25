import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { PARTNER_SOURCES } from '../../constants/partnerSources'
import { PARTNER_NOTICE_TEXT } from '../map/PartnerNoticeModal'
import ModalHeader from './ModalHeader'

interface PartnerSourcesModalProps {
  visible: boolean
  onClose: () => void
}

export default function PartnerSourcesModal({ visible, onClose }: PartnerSourcesModalProps) {
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container} edges={['top']}>
        <ModalHeader title="제휴 출처" onClose={onClose} />
        <ScrollView style={styles.body}>
          <Text style={styles.intro}>{PARTNER_NOTICE_TEXT}</Text>
          {PARTNER_SOURCES.map((source) => (
            <View key={source.affiliation} style={styles.card}>
              <Text style={styles.affiliation}>{source.affiliation}</Text>
              {source.period && <Text style={styles.period}>제휴기간 {source.period}</Text>}
              {source.links.map((link) => (
                <TouchableOpacity
                  key={link.url}
                  style={styles.linkRow}
                  onPress={() => Linking.openURL(link.url)}
                >
                  <Ionicons name="link-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.linkText} numberOfLines={1}>
                    {link.label}
                  </Text>
                  <Ionicons name="open-outline" size={13} color="#ccc" />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { padding: 20 },
  intro: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORS.sectionBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
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
