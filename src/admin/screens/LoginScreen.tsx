import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { buildAdminLoginUrl } from '../api'
import { ADMIN_COLORS, Card, InlineError } from '../ui'

/**
 * 관리자 로그인. 팝업·fetch 가 아니라 전체 페이지 이동으로 카카오 로그인에 보낸다
 * (OAuth state 쿠키가 API 도메인에 붙어야 해서). 돌아오면 `/admin?code=...` 로 도착한다.
 */
export default function LoginScreen({ message }: { message: string | null }) {
  const loginUrl = buildAdminLoginUrl()
  const [leaving, setLeaving] = useState(false)

  const startLogin = () => {
    if (!loginUrl) return
    setLeaving(true)
    window.location.assign(loginUrl)
  }

  return (
    <View style={styles.page}>
      <Card style={styles.card}>
        <View style={styles.titleRow}>
          <Ionicons name="shield-checkmark-outline" size={26} color={COLORS.primary} />
          <Text style={styles.title}>홍익온 관리자</Text>
        </View>
        <Text style={styles.description}>
          제보 검토, 문의 처리, 크롤러 실행 등 운영 작업을 하는 곳입니다. 관리자 권한이 있는 카카오 계정으로 로그인하세요.
        </Text>

        {message ? <InlineError message={message} /> : null}

        {loginUrl ? (
          <Pressable
            onPress={startLogin}
            disabled={leaving}
            accessibilityRole="button"
            style={({ pressed }) => [styles.kakao, (pressed || leaving) && styles.kakaoPressed]}
          >
            <Ionicons name="chatbubble" size={18} color="#191919" />
            <Text style={styles.kakaoText}>{leaving ? '카카오로 이동하는 중…' : '카카오로 로그인'}</Text>
          </Pressable>
        ) : (
          <InlineError message="API 서버 주소가 설정되지 않았습니다. EXPO_PUBLIC_API_ORIGIN(또는 절대 주소의 EXPO_PUBLIC_API_BASE_URL)을 확인해주세요." />
        )}

        <Text style={styles.note}>로그인 정보는 이 탭에만 보관되며, 탭을 닫으면 로그아웃됩니다.</Text>
        {__DEV__ ? (
          <Text style={styles.devNote}>
            개발 모드: 주소 끝에 ?mock=1 을 붙이면 백엔드 없이 목업 데이터로 볼 수 있습니다(?mock=403 은 권한 없음 화면).
            실제 로그인은 서버 허용 목록에 있는 주소(예: http://localhost:8081/admin)에서만 돌아옵니다.
          </Text>
        ) : null}
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: ADMIN_COLORS.pageBg },
  card: { width: '100%', maxWidth: 420, gap: 16, padding: 28 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.textPrimary },
  description: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.textSecondary },
  kakao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: ADMIN_COLORS.kakao,
  },
  kakaoPressed: { opacity: 0.7 },
  kakaoText: { fontFamily: FONTS.semibold, fontSize: 15, color: '#191919' },
  note: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  devNote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: ADMIN_COLORS.warning,
    backgroundColor: ADMIN_COLORS.warningBg,
    padding: 10,
    borderRadius: 8,
  },
})
