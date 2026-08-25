import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import type { AppNotice } from '../../constants/appNotices'
import ModalHeader from './ModalHeader'

interface NoticeDetailModalProps {
  visible: boolean
  notice: AppNotice | null
  onClose: () => void
}

export default function NoticeDetailModal({ visible, notice, onClose }: NoticeDetailModalProps) {
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container} edges={['top']}>
        <ModalHeader title="공지사항" onClose={onClose} />
        {notice && (
          <ScrollView style={styles.body}>
            <Text style={styles.date}>{notice.date}</Text>
            <Text style={styles.title}>{notice.title}</Text>
            <Text style={styles.text}>{notice.body}</Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { flex: 1, padding: 20 },
  date: { fontFamily: FONTS.regular, fontSize: 12, color: '#bbb', marginBottom: 8 },
  title: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 16 },
  text: { fontFamily: FONTS.regular, fontSize: 13, color: '#666', lineHeight: 22 },
})
