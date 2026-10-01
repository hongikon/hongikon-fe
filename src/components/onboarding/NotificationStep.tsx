import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { SUBSCRIBABLE_ITEMS } from '../../constants/news'
import { useSettings } from '../../contexts/SettingsContext'
import { requestNotificationPermission } from '../../lib/notificationPermission'
import { OnboardingPrimaryButton, OnboardingTextButton } from './OnboardingButtons'
import { ONBOARDING_TINT } from './OnboardingIllustration'
import BrandSymbol from '../../../assets/brand/symbol.svg'

interface NotificationStepProps {
  /** 허용 창을 띄운 뒤(결과와 무관하게) 또는 "나중에"를 누르면 부른다. */
  onDone: () => void
}

/**
 * 알림 허용 단계(iOS·Android 만 — 웹은 원격 푸시가 없어 OnboardingScreen 이 이 단계를 건너뛴다).
 * 이유를 먼저 보여준 뒤 사용자가 "알림 받기"를 누를 때만 시스템 허용 창을 띄운다.
 * iOS 는 한 번 거절하면 다시 묻지 않아서, 설명 없이 바로 띄우지 않는다.
 * "나중에"를 골라도 설정 > 알림에서 다시 켤 수 있다.
 */
export default function NotificationStep({ onDone }: NotificationStepProps) {
  const { settings } = useSettings()
  const [requesting, setRequesting] = useState(false)

  // 방금 고른 학과가 있으면 예시 알림에 그 이름을 쓴다. 고른 게 없으면 대표 예시.
  const firstDeptId = settings.subscribedDepts[0]
  const deptName = SUBSCRIBABLE_ITEMS.find((item) => item.id === firstDeptId)?.name ?? '컴퓨터공학과'

  const handleAllow = useCallback(async () => {
    setRequesting(true)
    try {
      await requestNotificationPermission()
    } finally {
      setRequesting(false)
      onDone()
    }
  }, [onDone])

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.halo} />
          <View style={[styles.card, styles.cardBack]} />
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <BrandSymbol width={18} height={18} />
              <Text style={styles.cardApp}>홍익온</Text>
              <Text style={styles.cardTime}>지금</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {deptName} 새 공지
            </Text>
            <Text style={styles.cardBody} numberOfLines={1}>
              2학기 수강신청 일정 안내
            </Text>
          </View>
          <View style={styles.bell}>
            <Ionicons name="notifications" size={22} color={COLORS.white} />
          </View>
        </View>

        <Text style={styles.title}>새 공지가 올라오면{'\n'}바로 알려드릴게요</Text>
        <Text style={styles.body}>
          구독한 게시판의 새 공지와 캠퍼스 제보 소식을{'\n'}알림으로 받아요. 게시판마다 켜고 끌 수 있어요.
        </Text>
      </View>

      <View style={styles.bottom}>
        <OnboardingPrimaryButton label="알림 받기" onPress={handleAllow} loading={requesting} />
        <OnboardingTextButton label="나중에" onPress={onDone} disabled={requesting} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  art: { width: 280, height: 210, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  halo: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: ONBOARDING_TINT,
  },
  card: {
    width: 248,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  // 앞 카드 아래로 한 장이 살짝 비치게 겹쳐 알림이 쌓이는 느낌만 준다.
  cardBack: {
    position: 'absolute',
    width: 216,
    height: 60,
    bottom: 50,
    opacity: 0.75,
    shadowOpacity: 0.06,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  cardApp: { flex: 1, fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  cardTime: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  cardTitle: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  cardBody: { marginTop: 2, fontSize: 13, fontFamily: FONTS.regular, color: '#6B6B76' },
  bell: {
    position: 'absolute',
    top: 14,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  title: {
    fontSize: 24,
    lineHeight: 33,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  body: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: FONTS.regular,
    color: '#6B6B76',
    textAlign: 'center',
  },
  bottom: { paddingHorizontal: 20, paddingBottom: 4 },
})
