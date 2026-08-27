import { View, Text, Image, StyleSheet } from 'react-native'
import { FONTS } from '../constants/typography'
import { COLORS } from '../constants/colors'
import { SAMPLE_NEWS_NOTIFICATION, SAMPLE_REPORT_NOTIFICATION } from '../constants/pushNotificationSamples'
import { formatPushNotification } from '../utils/notificationFormat'
import type { PushNotificationData } from '../types'

/**
 * 임시 - 알림 카드가 실제로 어떻게 보일지 웹에서 바로 확인하는 화면. `/temp/notifications`
 * 로 접근한다(`App.tsx` 참고). `hongikon-be`에 발송부가 없어(`AppStatusScreen`의 로컬
 * 알림 발사 버튼 참고) 기기 OS 알림 배너로는 못 보므로, 같은 표본 payload를
 * `formatPushNotification`으로 포맷해 카드 모양만 흉내 낸다 — 실제 알림 UI(OS 배너)와는
 * 다르다. 백엔드 발송부가 생기면 이 파일은 지워도 된다.
 *
 * 배지는 카테고리 아이콘 대신 실제 앱 아이콘(`assets/icon.png`)을 그대로 쓴다.
 * 실기기 알림에서도 아이콘 영역엔 앱 아이콘이 뜨므로(iOS는 항상, Android는
 * `app.json`의 `expo-notifications` 플러그인에 `android-icon-monochrome.png`를
 * 지정해 상태바 아이콘도 앱 아이콘과 같은 마크를 쓰게 맞춰 뒀다) 미리보기도 맞춘다.
 */
export default function TempNotificationPreviewScreen() {
  const samples = [SAMPLE_NEWS_NOTIFICATION, SAMPLE_REPORT_NOTIFICATION].filter(
    (data): data is PushNotificationData => data !== null,
  )

  return (
    <View style={styles.page}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>임시 · 알림 UI 미리보기 (/temp/notifications)</Text>
        <Text style={styles.bannerSubtext}>
          hongikon-be에 아직 발송부가 없어 실제 OS 알림 배너로는 확인할 수 없다. 아래는 같은
          data payload를 카드로 흉내 낸 것 — 실제 기기 알림 모양과는 다를 수 있다.
        </Text>
      </View>

      <View style={styles.phone}>
        {samples.map((data, index) => (
          <NotificationCard key={index} data={data} />
        ))}
      </View>
    </View>
  )
}

function NotificationCard({ data }: { data: PushNotificationData }) {
  const formatted = formatPushNotification(data)
  if (!formatted) return null

  return (
    <View style={styles.card}>
      <Image source={require('../../assets/icon.png')} style={styles.appIcon} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.appName}>홍익온</Text>
          <Text style={styles.timestamp}>지금</Text>
        </View>
        <Text style={styles.cardTitle}>{formatted.title}</Text>
        <Text style={styles.cardBodyText} numberOfLines={2}>
          {formatted.body}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#111827', paddingTop: 44 },
  banner: { paddingHorizontal: 20, paddingBottom: 16 },
  bannerText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: '#FDE68A',
  },
  bannerSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    lineHeight: 17,
  },
  phone: { paddingHorizontal: 12, gap: 10 },
  card: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    padding: 12,
  },
  appIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  cardBody: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  appName: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timestamp: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textTertiary },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  cardBodyText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
})
