import { Text, StyleSheet, ScrollView, Modal } from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { SPACING } from '../../constants/spacing'
import { FONTS } from '../../constants/typography'
import { TERMS_TEXT } from '../../constants/legalText'
import ModalHeader, { ModalPanel } from './ModalHeader'
import ContentColumn from '../common/ContentColumn'

interface TermsModalProps {
  visible: boolean
  onClose: () => void
}

export default function TermsModal({ visible, onClose }: TermsModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
        <ContentColumn>
        <ModalHeader title="이용약관" onClose={onClose} />
        <ModalPanel>
        <ScrollView style={styles.body}>
          <Text style={styles.title}>홍익온 이용약관</Text>
          <Text style={styles.text}>{TERMS_TEXT}</Text>
        </ScrollView>
        </ModalPanel>
        </ContentColumn>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // 회색 바탕 위에 머리 카드와 둥근 흰 본문 판이 뜬다(10-07 설정 탭과 같은 모양).
  container: { flex: 1, backgroundColor: COLORS.background },
  // 글자 왼쪽 끝을 아래 카드들과 같은 28(판 바깥 12 + 안쪽 16)에 맞춘다(10-08).
  body: { flex: 1, paddingHorizontal: SPACING.lg, paddingVertical: 20 },
  title: { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 16 },
  text: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, lineHeight: 22 },
})
