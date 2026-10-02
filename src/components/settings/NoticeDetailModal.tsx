import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import type { AppNotice } from '../../constants/appNotices'
import ModalHeader from './ModalHeader'
import ContentColumn from '../common/ContentColumn'

interface NoticeDetailModalProps {
  visible: boolean
  notice: AppNotice | null
  onClose: () => void
}

export default function NoticeDetailModal({ visible, notice, onClose }: NoticeDetailModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
        <ContentColumn>
        <ModalHeader title="공지사항" onClose={onClose} />
        {notice && (
          <ScrollView style={styles.body}>
            <Text style={styles.date}>{notice.date}</Text>
            <Text style={styles.title}>{notice.title}</Text>
            <Text style={styles.text}>{notice.body}</Text>
          </ScrollView>
        )}
        </ContentColumn>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { flex: 1, padding: 20 },
  date: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginBottom: 8 },
  title: { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 16 },
  text: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, lineHeight: 22 },
})
