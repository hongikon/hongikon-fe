import { Text, StyleSheet, ScrollView, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { PRIVACY_TEXT } from '../../constants/legalText'
import ModalHeader from './ModalHeader'

interface PrivacyModalProps {
  visible: boolean
  onClose: () => void
}

export default function PrivacyModal({ visible, onClose }: PrivacyModalProps) {
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container} edges={['top']}>
        <ModalHeader title="개인정보 처리방침" onClose={onClose} />
        <ScrollView style={styles.body}>
          <Text style={styles.title}>개인정보 처리방침</Text>
          <Text style={styles.text}>{PRIVACY_TEXT}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { flex: 1, padding: 20 },
  title: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 16 },
  text: { fontFamily: FONTS.regular, fontSize: 13, color: '#666', lineHeight: 22 },
})
