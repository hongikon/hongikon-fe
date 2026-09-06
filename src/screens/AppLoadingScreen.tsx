import { Text, StyleSheet, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'

/**
 * AuthContext가 저장된 로그인 상태(토큰/게스트 여부)를 읽어오는 동안 보여준다.
 * 이 확인은 기기 저장소 접근이라 순간적이지만, 그 사이 빈 화면이 뜨면
 * 앱이 멈춘 것처럼 보여서 로고+스피너로 대체한다.
 */
export default function AppLoadingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Image
        source={require('../../assets/splash-icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator color={COLORS.primary} style={styles.spinner} />
      <Text style={styles.label}>불러오는 중…</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logo: { width: 96, height: 96, borderRadius: 24, marginBottom: 8 },
  spinner: { marginTop: 4 },
  label: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
})
