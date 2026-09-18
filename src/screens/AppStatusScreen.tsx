import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { SAMPLE_NEWS_NOTIFICATION, SAMPLE_REPORT_NOTIFICATION } from '../constants/pushNotificationSamples'
import { formatPushNotification } from '../utils/notificationFormat'
import { getBackendStatus } from '../apis/status'
import { API_BASE_URL } from '../apis/client'
import { useApiResource } from '../hooks/useApiResource'
import RetryableError from '../components/common/RetryableError'
import type { PushNotificationData } from '../types'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavProp = NativeStackNavigationProp<RootStackParamList>

/** `app.config.ts` 가 넣어 주는 빌드 환경. 테스터가 지금 어느 빌드를 보고 있는지 구분하려고 띄운다. */
const APP_VARIANT_LABEL: Record<string, string> = {
  development: '개발',
  preview: '테스트(내부 배포)',
  production: '운영',
}

const EXECUTION_ENVIRONMENT_LABEL: Record<string, string> = {
  standalone: '독립 실행형 빌드',
  storeClient: 'Expo Go',
  bare: 'Bare 워크플로우',
}

/**
 * `hongikon-be`에 아직 발송부가 없어(`src/lib/pushNotifications.ts` 참고) 실제
 * 원격 푸시로는 확인할 수 없다 — 대신 같은 `data` payload로 기기에 바로 로컬
 * 알림을 띄운다. 탭하면 실제 원격 푸시를 탭했을 때와 똑같이 라우팅된다
 * (`usePushNotifications`의 리스너가 처리). 웹에서 카드 모양만 보려면
 * `/temp/notifications`(`TempNotificationPreviewScreen`)를 쓴다.
 */
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
  const sampleNewsNotification = SAMPLE_NEWS_NOTIFICATION

  const buildId =
    Platform.OS === 'ios' ? config?.ios?.buildNumber : String(config?.android?.versionCode ?? '-')

  const compatibleBackendVersion = (config?.extra?.compatibleBackendVersion as string | undefined) ?? '-'
  // 연결이 불안정하면 client 가 자동 재시도하고, 그래도 실패하면 아래 "다시 시도" 안내를 띄운다.
  // 연결이 돌아오거나 앱으로 돌아오면 훅이 알아서 다시 확인한다.
  const backendStatus = useApiResource(
    (signal) => getBackendStatus({ signal }),
    [],
    { fallbackMessage: '백엔드 상태를 확인하지 못했습니다.' },
  )
  const backendVersion = backendStatus.data?.version ?? null
  const backendCheckFailed = backendStatus.errorMessage !== null && backendVersion === null

  const backendVersionLabel = backendCheckFailed
    ? '연결 실패'
    : (backendVersion ?? '확인 중…')
  const backendVersionMatches = backendVersion !== null && backendVersion === compatibleBackendVersion

  const appVariant = String(config?.extra?.appVariant ?? 'production')

  const rows: { label: string; value: string }[] = [
    { label: '앱 이름', value: config?.name ?? '-' },
    { label: '빌드 환경', value: APP_VARIANT_LABEL[appVariant] ?? appVariant },
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

  const backendRows: { label: string; value: string }[] = [
    { label: '연결된 백엔드 주소', value: API_BASE_URL || '미설정' },
    { label: '이 빌드가 필요로 하는 백엔드 버전', value: compatibleBackendVersion },
    { label: '지금 연결된 백엔드 버전', value: backendVersionLabel },
    {
      label: '버전 일치 여부',
      value: backendCheckFailed ? '확인 불가' : backendVersion === null ? '확인 중…' : backendVersionMatches ? '✅ 일치' : '⚠️ 불일치',
    },
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

        {backendStatus.errorMessage !== null && (
          <RetryableError
            style={styles.backendError}
            message={backendStatus.errorMessage}
            isNetworkError={backendStatus.isNetworkError}
            onRetry={backendStatus.canRetry ? backendStatus.retry : undefined}
            retrying={backendStatus.loading || backendStatus.refreshing}
          />
        )}

        <View style={styles.section}>
          {backendRows.map((row) => (
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
            {sampleNewsNotification && (
              <TouchableOpacity
                style={styles.row}
                onPress={() => fireTestNotification(sampleNewsNotification)}
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
  backendError: { marginHorizontal: 12, marginTop: 8 },
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
