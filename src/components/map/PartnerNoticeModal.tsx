import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'

const STORAGE_KEY = '@hongik_partner_notice_seen'

export const PARTNER_NOTICE_TEXT =
  '해당 정보들은 각 단과대의 instagram을 참고하여 제작하였으며 잘못된 제휴 내용은 업데이트를 위해 제보 부탁드립니다.'

/**
 * 앱을 처음 열었을 때 한 번만 뜨는 제휴 정보 출처 안내.
 * 확인을 누르면 AsyncStorage 에 플래그를 남겨 다음부터는 뜨지 않는다.
 * 같은 문구는 설정 탭 공지사항에도 실려 있어, 언제든 다시 확인할 수 있다.
 */
export default function PartnerNoticeModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((seen) => {
        if (!seen) setVisible(true)
      })
      .catch(() => {})
  }, [])

  const handleConfirm = () => {
    setVisible(false)
    AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {})
  }

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleConfirm}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="information-circle" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>제휴 정보 안내</Text>
          <Text style={styles.body}>{PARTNER_NOTICE_TEXT}</Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmText}>확인했습니다</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  iconWrap: { marginBottom: 8 },
  title: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginBottom: 10 },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  confirmBtn: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.white },
})
