import { Text, StyleSheet, ScrollView, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { TERMS_TEXT } from '../../constants/legalText'
import ModalHeader from './ModalHeader'

interface TermsModalProps {
  visible: boolean
  onClose: () => void
}

export default function TermsModal({ visible, onClose }: TermsModalProps) {
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container} edges={['top']}>
        <ModalHeader title="이용약관" onClose={onClose} />
        <ScrollView style={styles.body}>
          <Text style={styles.title}>홍익온 이용약관</Text>
          <Text style={styles.text}>{TERMS_TEXT}</Text>
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
