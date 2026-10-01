import { Text, StyleSheet, ScrollView, Modal } from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
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
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ModalHeader title="이용약관" onClose={onClose} />
        <ScrollView style={styles.body}>
          <Text style={styles.title}>홍익온 이용약관</Text>
          <Text style={styles.text}>{TERMS_TEXT}</Text>
        </ScrollView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { flex: 1, padding: 20 },
  title: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 16 },
  text: { fontFamily: FONTS.regular, fontSize: 13, color: '#666', lineHeight: 22 },
})
