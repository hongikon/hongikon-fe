import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { NEWS_DATA } from '../constants/news'
import { formatPushNotification } from '../utils/notificationFormat'
import type { PushNotificationData } from '../types'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavProp = NativeStackNavigationProp<RootStackParamList>

const EXECUTION_ENVIRONMENT_LABEL: Record<string, string> = {
  standalone: '독립 실행형 빌드',
  storeClient: 'Expo Go',
  bare: 'Bare 워크플로우',
}

/**
 * 알림 포맷을 눈으로 확인하기 위한 표본. `hongikon-be`에 아직 발송부가 없어
 * (`src/lib/pushNotifications.ts` 참고) 실제 원격 푸시로는 확인할 수 없다 —
 * 대신 같은 `data` payload로 기기에 바로 로컬 알림을 띄운다. 탭하면 실제 원격
 * 푸시를 탭했을 때와 똑같이 라우팅된다(`usePushNotifications`의 리스너가 처리).
 */
const SAMPLE_NEWS_NOTIFICATION: PushNotificationData | null = NEWS_DATA[0]
  ? { type: 'NEWS', newsId: NEWS_DATA[0].id }
  : null

const SAMPLE_REPORT_NOTIFICATION: PushNotificationData = {
  type: 'REPORT',
  reportId: -1,
  lat: 37.5527515,
  lng: 126.9250927,
  floor: 2,
  category: 'FOOD_TRUCK',
  title: '붕어빵 트럭 왔어요',
}

async function fireTestNotification(data: PushNotificationData) {
  const formatted = formatPushNotification(data)
  if (!formatted) {
    Alert.alert('알림 표본 없음', '표본으로 쓸 소식 데이터가 없습니다.')
    return
  }

  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert('알림 권한 필요', '기기 설정에서 알림 권한을 허용해주세요.')
    return
  }

  await Notifications.scheduleNotificationAsync({
    content: { title: formatted.title, body: formatted.body, data },
    trigger: null,
  })
}

export default function AppStatusScreen() {
  const navigation = useNavigation<NavProp>()
  const config = Constants.expoConfig

  const buildId =
    Platform.OS === 'ios' ? config?.ios?.buildNumber : String(config?.android?.versionCode ?? '-')

  const rows: { label: string; value: string }[] = [
    { label: '앱 이름', value: config?.name ?? '-' },
    { label: '버전', value: config?.version ?? '-' },
    { label: '빌드 번호', value: buildId ?? '-' },
    { label: '플랫폼', value: `${Platform.OS} ${Platform.Version}` },
    { label: 'Expo SDK', value: Constants.expoVersion ?? config?.sdkVersion ?? '-' },
    {
      label: '실행 환경',
      value: EXECUTION_ENVIRONMENT_LABEL[Constants.executionEnvironment ?? ''] ?? '알 수 없음',
    },
    { label: '업데이트 채널', value: Constants.expoConfig?.updates?.url ? '연결됨' : '미설정' },
  ]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>앱 상태</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.section}>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value}>{row.value}</Text>
            </View>
          ))}
        </View>

        {__DEV__ && Platform.OS !== 'web' && (
          <View style={styles.section}>
            <Text style={styles.devSectionTitle}>
              개발자 도구 — 알림 포맷 미리보기 (배포 빌드에는 없음)
            </Text>
            {SAMPLE_NEWS_NOTIFICATION && (
              <TouchableOpacity
                style={styles.row}
                onPress={() => fireTestNotification(SAMPLE_NEWS_NOTIFICATION)}
              >
                <Text style={styles.label}>소식 알림 테스트 보내기</Text>
                <Ionicons name="chevron-forward" size={13} color="#ddd" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.row}
              onPress={() => fireTestNotification(SAMPLE_REPORT_NOTIFICATION)}
            >
              <Text style={styles.label}>제보 알림 테스트 보내기</Text>
              <Ionicons name="chevron-forward" size={13} color="#ddd" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  scroll: { flex: 1, backgroundColor: COLORS.sectionBg },
  section: { backgroundColor: COLORS.white, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f4f4f4',
  },
  label: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPrimary },
  value: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
  devSectionTitle: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textTertiary,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    letterSpacing: 0.6,
  },
})
