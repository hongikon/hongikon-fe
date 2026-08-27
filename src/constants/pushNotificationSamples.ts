import { NEWS_DATA } from './news'
import type { PushNotificationData } from '../types'

/**
 * 알림 포맷을 눈으로 확인하기 위한 표본. `hongikon-be`에 아직 발송부가 없어
 * (`src/lib/pushNotifications.ts` 참고) 실제 원격 푸시로는 확인할 수 없다.
 * `AppStatusScreen`(기기 내 로컬 알림)과 `TempNotificationPreviewScreen`
 * (`/temp/notifications`, 웹 카드 미리보기) 양쪽이 같은 표본을 쓴다.
 */
export const SAMPLE_NEWS_NOTIFICATION: PushNotificationData | null = NEWS_DATA[0]
  ? { type: 'NEWS', newsId: NEWS_DATA[0].id }
  : null

export const SAMPLE_REPORT_NOTIFICATION: PushNotificationData = {
  type: 'REPORT',
  reportId: -1,
  lat: 37.5527515,
  lng: 126.9250927,
  floor: 2,
  category: 'FOOD_TRUCK',
  title: '붕어빵 트럭 왔어요',
}
