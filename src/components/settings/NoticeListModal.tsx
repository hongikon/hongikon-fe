import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import type { AppNotice } from '../../constants/appNotices'
import ModalHeader from './ModalHeader'
import ContentColumn from '../common/ContentColumn'

interface NoticeListModalProps {
  visible: boolean
  notices: AppNotice[]
  onClose: () => void
  onSelectNotice: (notice: AppNotice) => void
}

export default function NoticeListModal({
  visible,
  notices,
  onClose,
  onSelectNotice,
}: NoticeListModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
        <ContentColumn>
        <ModalHeader title="앱 공지사항" onClose={onClose} />
        <ScrollView style={styles.body}>
          {notices.map((notice) => (
            <TouchableOpacity
              key={notice.id}
              style={styles.item}
              onPress={() => onSelectNotice(notice)}
            >
              <Text style={styles.itemTitle}>{notice.title}</Text>
              <Text style={styles.itemDate}>{notice.date}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        </ContentColumn>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { padding: 20 },
  item: {
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f4f4f4',
  },
  itemTitle: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textPrimary, marginBottom: 3 },
  itemDate: { fontFamily: FONTS.regular, fontSize: 11, color: '#bbb' },
})
