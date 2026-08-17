import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavProp = NativeStackNavigationProp<RootStackParamList>

const EXECUTION_ENVIRONMENT_LABEL: Record<string, string> = {
  standalone: '독립 실행형 빌드',
  storeClient: 'Expo Go',
  bare: 'Bare 워크플로우',
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
})
