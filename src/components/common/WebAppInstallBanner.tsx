import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import IconButton from './IconButton'
import { RADIUS } from '../../constants/spacing'
import { useWebAppInstallBanner } from '../../hooks/common/useWebAppInstallBanner'

/**
 * 웹판을 휴대폰 브라우저로 볼 때 화면 맨 위에 붙는 앱 설치 안내(Safari 기본 배너와 같은 자리·모양).
 * 겹쳐 띄우지 않고 화면을 그만큼 아래로 민다. 닫으면 14일 동안 숨긴다(브라우저 저장소, 못 쓰면 이번 방문만).
 * 앱이 깔려 있으면 스토어 화면에 '열기'가 나온다.
 */
export default function WebAppInstallBanner() {
  const { store, hidden, setHidden, dismiss } = useWebAppInstallBanner()
  if (!store || hidden) return null

  return (
    <View style={styles.bar}>
      <IconButton icon="close" size={16} color={COLORS.textTertiary} onPress={dismiss} accessibilityLabel="앱 설치 안내 닫기" />
      <Image source={require('../../../assets/icon.png')} style={styles.icon} accessibilityIgnoresInvertColors />
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          홍익온 앱
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          공지 알림은 앱에서 받을 수 있어요
        </Text>
      </View>
      <TouchableOpacity
        style={styles.cta}
        // 인앱 브라우저는 새 창(window.open)을 막는 경우가 있어 지금 창에서 스토어로 넘어간다.
        onPress={() => window.location.assign(store.url)}
        accessibilityRole="link"
        accessibilityLabel={`${store.label}에서 홍익온 받기`}
      >
        <Text style={styles.ctaText}>앱 받기</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  icon: { width: 36, height: 36, borderRadius: RADIUS.sm },
  texts: { flex: 1, minWidth: 0 },
  title: { fontFamily: FONTS.semibold, fontSize: 13.5, color: COLORS.textPrimary },
  sub: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  cta: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.white },
})
