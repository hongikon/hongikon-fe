import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { RADIUS, SPACING } from '../../constants/spacing'
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
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
          {notices.map((notice, i) => (
            <TouchableOpacity
              key={notice.id}
              style={[styles.item, i > 0 && styles.itemDivider]}
              onPress={() => onSelectNotice(notice)}
              accessibilityRole="button"
            >
              <Text style={styles.itemTitle}>{notice.title}</Text>
              <Text style={styles.itemDate}>{notice.date}</Text>
            </TouchableOpacity>
          ))}
          </View>
        </ScrollView>
        </ContentColumn>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // 회색 바탕 위에 머리 카드와 공지 목록 카드가 뜬다(10-07 설정 탭 묶음 카드와 같은 모양).
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { paddingTop: SPACING.xs, paddingBottom: SPACING.xl },
  card: {
    marginHorizontal: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.floating,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  item: { paddingVertical: 14 },
  itemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  itemTitle: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.textPrimary, marginBottom: 4 },
  itemDate: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
})
