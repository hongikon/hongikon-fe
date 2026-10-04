import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { TYPE } from '../../constants/typography'
import { SPACING } from '../../constants/spacing'
import { unhideAuthor, useHiddenAuthors } from '../../lib/hiddenAuthors'
import ModalHeader from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import ListRow from '../common/ListRow'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import { useToast } from '../common/Toast'

interface HiddenUsersModalProps {
  visible: boolean
  onClose: () => void
}

/**
 * 설정 > 일반 > 숨긴 사용자. 제보 시트에서 "이 사용자 숨기기"로 숨긴 작성자를 다시 보이게 한다.
 * 상대가 누군지 드러나지 않게 이름(앱 닉네임 또는 '익명 사용자')만 보이고, 숨긴 날짜 같은 다른 정보는 두지 않는다.
 */
export default function HiddenUsersModal({ visible, onClose }: HiddenUsersModalProps) {
  const hidden = useHiddenAuthors()
  const toast = useToast()

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ContentColumn>
        <ModalHeader title="숨긴 사용자" onClose={onClose} />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.intro}>
            숨긴 사용자의 제보는 이 기기의 지도에서 보이지 않아요. 숨긴 목록은 이 기기에만 저장되고 상대에게 알려지지 않아요.
          </Text>
          {hidden.length === 0 ? (
            <EmptyState
              icon="eye-off-outline"
              message="숨긴 사용자가 없어요"
              description="지도에서 제보를 누른 뒤 “이 사용자 숨기기”로 숨길 수 있어요"
              style={styles.empty}
            />
          ) : (
            <View style={styles.list}>
              {hidden.map((entry, index) => (
                <ListRow
                  key={entry.key}
                  icon="person-outline"
                  label={entry.label}
                  last={index === hidden.length - 1}
                  right={
                    <Button
                      label="다시 보기"
                      size="sm"
                      variant="secondary"
                      fullWidth={false}
                      onPress={() => {
                        unhideAuthor(entry.key)
                        toast.show({ message: '이 사용자의 제보를 다시 보여 드려요', tone: 'info' })
                      }}
                      accessibilityLabel={`${entry.label} 다시 보기`}
                    />
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>
        </ContentColumn>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { padding: SPACING.lg },
  intro: { ...TYPE.caption, color: COLORS.textSecondary, marginBottom: SPACING.md },
  empty: { marginTop: SPACING.xl },
  list: { borderRadius: 12, overflow: 'hidden' },
})
