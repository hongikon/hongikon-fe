import { useEffect, useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useIsFocused } from '@react-navigation/native'
import Button from '../common/Button'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import { DIALOG_MAX_WIDTH } from '../../constants/layout'
import { useAuth } from '../../contexts/AuthContext'
import { getNearbySettings, nearbyAlertsAvailable } from '../../lib/nearbyPartners/background'
import { requestSettingsIntent } from '../../lib/settingsIntents'
import { navigationRef } from '../../navigation/navigationRef'
import { usePartnerNoticePending } from './PartnerNoticeModal'

const SEEN_KEY = 'hongikon_nearby_filter_intro_seen_v1'

/**
 * 근처 제휴 알림 소개(11-12 사용자 요청). 업데이트한 사용자가 지도에서 '제휴 업체'를 처음 눌렀을 때 한 번만 띄운다.
 * 근처 알림을 쓸 수 있는 빌드·로그인·아직 안 켬일 때만(NearbyAlertPromo 와 같은 조건), 첫 실행 제휴 안내 창이 닫힌 뒤에만 —
 * 네이티브 Modal 두 개가 겹치면 뒤 것이 안 열리고 화면이 막혔다(PartnerNoticeModal 참고). 한 번 닫으면 다시 띄우지 않는다.
 */
export default function NearbyFilterIntro({ active }: { active: boolean }) {
  const { status } = useAuth()
  const noticePending = usePartnerNoticePending()
  const focused = useIsFocused()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!active || noticePending || status !== 'authenticated' || !nearbyAlertsAvailable()) return
    let alive = true
    void (async () => {
      const seen = await AsyncStorage.getItem(SEEN_KEY).catch(() => '1')
      if (seen) return
      const settings = await getNearbySettings()
      if (!alive) return
      if (settings.enabled) {
        // 이미 켠 사람에게는 소개할 필요가 없다. 다시 묻지 않게 본 것으로 둔다.
        AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {})
        return
      }
      setShow(true)
    })()
    return () => {
      alive = false
    }
  }, [active, noticePending, status])

  if (!show || !focused) return null

  const close = () => {
    setShow(false)
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {})
  }

  const openSettings = () => {
    close()
    requestSettingsIntent({ type: 'openNearbyAlerts' })
    if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Settings' })
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="navigate" size={24} color={COLORS.white} />
          </View>
          <Text style={styles.badge}>새 기능</Text>
          <Text style={styles.title}>제휴 가게 근처에 있으면 알려 드려요</Text>
          <Text style={styles.body}>
            근처 제휴 알림을 켜 두면 제휴 가게에 잠시 머물 때 그 가게의 학생 혜택을 알림으로 보내 드려요. 위치는 휴대폰 안에서만 쓰고
            서버로 보내지 않아요.
          </Text>
          <View style={styles.buttons}>
            <Button label="켜러 가기" onPress={openSettings} size="md" />
            <Button label="다음에" onPress={close} size="md" variant="secondary" />
          </View>
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
    backgroundColor: COLORS.scrim,
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: DIALOG_MAX_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  badge: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.primary, marginBottom: 4 },
  title: { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  buttons: { alignSelf: 'stretch', gap: 8 },
})
