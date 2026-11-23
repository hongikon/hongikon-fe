import { Platform, Alert } from 'react-native'
import * as Notifications from 'expo-notifications'
import { type PushNotificationSample } from '../../constants/pushNotificationSamples'

/**
 * 서버 푸시와 같은 제목·본문·`data` payload로 기기에 바로 로컬 알림을 띄운다. 탭하면 실제 원격 푸시를
 * 탭했을 때와 똑같이 라우팅된다(`usePushNotifications`의 리스너가 처리). 웹에서 카드 모양만 보려면
 * `/temp/notifications`(`TempNotificationPreviewScreen`)를 쓴다.
 */
export async function fireTestNotification(sample: PushNotificationSample) {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert('알림 권한 필요', '기기 설정에서 알림 권한을 허용해 주세요.')
    return
  }

  await Notifications.scheduleNotificationAsync({
    content: { title: sample.title, body: sample.body, data: sample.data },
    // Android: 서버 푸시처럼 채널을 지정한다(관리자 표본은 "관리자 알림" 채널 — 관리자 계정에서만 만들어진다).
    trigger: Platform.OS === 'android' && sample.channelId ? { channelId: sample.channelId } : null,
  })
}
