import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { TYPE } from '../../../constants/typography'
import { RADIUS, SPACING } from '../../../constants/spacing'
import { accountInfoFor } from '../../../utils/auth/consent/privacyProcessingNotice'

/**
 * [개인정보 처리 안내] 가입 시트의 처리방침 확인 줄 아래 상자. 동의가 아니라 처리 "안내"다
 * (개인정보 보호법 제15조 제1항 제4호). 문구를 바꾸면 처리방침(PrivacyModal)과 맞는지 함께 본다.
 */
export default function PrivacyProcessingNotice({ provider }: { provider: 'kakao' | 'apple' | null }) {
  const accountInfo = accountInfoFor(provider)
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>개인정보 처리 안내</Text>
      <Text style={styles.noticeText}>
        · 회원 식별·로그인 유지: {accountInfo}. 탈퇴하면 바로 지워요.
      </Text>
      <Text style={styles.noticeText}>
        · 직접 올리는 정보: 앱 닉네임, 제보(사진·위치·내용)와 댓글, 문의 내용과 남긴 연락처.
      </Text>
      <Text style={styles.noticeText}>
        · 알림을 켜면: 알림을 보낼 기기 정보(푸시 토큰).
      </Text>
      <Text style={styles.noticeText}>
        · 알림·앱 업데이트·웹 화면 등 일부 정보는 미국의 서비스(Expo·Apple·Google·Netlify)를 거쳐 처리돼요.
      </Text>
      <Text style={styles.noticeText}>
        · 서비스 제공에 꼭 필요한 정보만 처리해 따로 동의를 받지 않아요. 자세한 내용은 처리방침에 있어요.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  notice: {
    marginLeft: 32,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    gap: SPACING.xxs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.fill,
  },
  noticeTitle: { ...TYPE.label, color: COLORS.textSecondary, marginBottom: SPACING.xxs },
  noticeText: { ...TYPE.caption, color: COLORS.textSecondary },
})
