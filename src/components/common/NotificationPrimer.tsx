import { Modal, StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import NotificationStep from '../onboarding/NotificationStep'
import { COLORS } from '../../constants/colors'
import { useNotificationPrimer } from '../../hooks/common/useNotificationPrimer'

/**
 * 로그인한 뒤 한 번 시스템 알림 허용 창을 띄운다(iOS·Android). 알림은 로그인한 계정 기준이라
 * 앱을 처음 켰을 때나 둘러보기(게스트) 중에는 묻지 않는다(10-02 결정).
 * 한 번 물은 뒤엔(허용·거절과 무관) 다시 자동으로 띄우지 않는다 — 설정 > 알림에서 "설정 열기"로 바꿀 수 있다.
 * 흐름: 앱 소개 → (로그인 또는 둘러보기) → 내 학과 고르기(처음 켠 기기만) → 로그인했으면 알림 안내 화면(NotificationStep)
 * → "알림 받기"를 누를 때만 시스템 허용 창.
 * 온보딩(다시 보기 포함)이나 학과 고르기가 남아 있으면 그게 끝날 때까지 기다린다 — 안내는 전체 화면 Modal 이라
 * 그대로 띄우면 학과 고르기를 덮는다. 끝나면 `ready` 가 true 로 바뀌며 아래 효과가 그때 한 번 돈다.
 * 둘러보기(게스트)면 안내 없이 넘어간다. 허용되면 기기 등록이 바로 이어진다(usePushNotifications).
 */
export default function NotificationPrimer() {
  const { showGuide, handleDone } = useNotificationPrimer()

  if (!showGuide) return null
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={handleDone}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.guide} edges={['top', 'bottom']}>
          <NotificationStep onDone={handleDone} />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  guide: { flex: 1, backgroundColor: COLORS.white, paddingHorizontal: 24 },
})
