import { useEffect, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import {
  requestNotificationPermission,
  useNotificationPermission,
} from '../../lib/notificationPermission'

/** "나중에"를 누른 적이 있으면 다시 자동으로 띄우지 않는다(설정 화면에서 언제든 켤 수 있다). */
const DISMISSED_KEY = '@hongikon_notification_primer_dismissed'

/**
 * 시스템 알림 허용 창을 띄우기 전에, 왜 필요한지 먼저 설명하는 화면.
 * 로그인했고 앱의 "구독 소식 알림"이 켜져 있는데 휴대폰 권한을 아직 묻지 않은 경우에만 한 번 보여준다.
 * (설명 없이 시스템 창부터 띄우면 거절되기 쉽고, iOS 는 한 번 거절하면 앱이 다시 물을 수 없다.)
 */
export default function NotificationPrimer() {
  const { status } = useAuth()
  const { settings } = useSettings()
  const permission = useNotificationPermission()
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((value) => setDismissed(value === '1'))
      .catch(() => setDismissed(false))
  }, [])

  const visible =
    Platform.OS !== 'web' &&
    status === 'authenticated' &&
    settings.subscriptionAlert &&
    dismissed === false &&
    permission.status === 'undetermined' &&
    permission.canAskAgain

  const handleLater = () => {
    setDismissed(true)
    AsyncStorage.setItem(DISMISSED_KEY, '1').catch(() => {})
  }

  const handleAllow = async () => {
    setRequesting(true)
    // 결과와 상관없이 이 안내는 다시 띄우지 않는다 — 허용되면 등록이 이어지고, 거절되면 설정 화면이 안내한다.
    await requestNotificationPermission()
    setRequesting(false)
    handleLater()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleLater}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <Ionicons name="notifications" size={30} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>새 소식 알림 받기</Text>
          <Text style={styles.body}>
            구독한 학과·게시판에 새 공지가 올라오면 바로 알려드려요.{'\n'}
            어떤 게시판과 분야를 받을지는 설정에서 언제든 바꿀 수 있어요.
          </Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={handleAllow}
            disabled={requesting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="알림 받기"
          >
            <Text style={styles.primaryText}>알림 받기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondary}
            onPress={handleLater}
            disabled={requesting}
            accessibilityRole="button"
            accessibilityLabel="나중에"
          >
            <Text style={styles.secondaryText}>나중에</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    alignItems: 'center',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontFamily: FONTS.semibold, fontSize: 18, color: COLORS.textPrimary, marginBottom: 8 },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  primary: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.white },
  secondary: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 4 },
  secondaryText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary },
})
