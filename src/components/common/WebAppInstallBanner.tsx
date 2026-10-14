import { useState } from 'react'
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { APP_STORE_URL, PLAY_STORE_URL } from '../../constants/storeLinks'
import IconButton from './IconButton'

const DISMISS_KEY = '@hongikon_install_banner_dismissed_until'
/** 닫으면 이만큼 다시 띄우지 않는다. */
const DISMISS_DAYS = 14

/** Safari 가 아닌 iOS 브라우저(카카오톡·네이버·인스타그램 인앱, Chrome·Firefox 등). 이들은 Safari 기본 배너를 띄우지 않는다. */
const NON_SAFARI_IOS = /CriOS|FxiOS|EdgiOS|OPiOS|KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|Whale/i

type Store = { url: string; label: string }

/**
 * 어느 스토어로 안내할지. 안내하지 않으면 null.
 * - iPhone Safari: `apple-itunes-app` 메타 태그로 iOS 가 기본 배너를 띄우므로 여기서는 띄우지 않는다(두 개가 겹치지 않게).
 * - iPhone 의 다른 브라우저: 이 배너로 App Store 를 연다.
 * - Android: Play 가 공개된 뒤(`PLAY_STORE_URL`)부터.
 * - 데스크톱·관리자 화면(/admin): 띄우지 않는다.
 */
function pickStore(): Store | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || typeof window === 'undefined') return null
  if (window.location.pathname.startsWith('/admin')) return null
  const ua = navigator.userAgent
  if (/iPhone|iPod/.test(ua)) {
    const safari = /Safari\//.test(ua) && !NON_SAFARI_IOS.test(ua)
    return safari ? null : { url: APP_STORE_URL, label: 'App Store' }
  }
  if (/Android/.test(ua) && PLAY_STORE_URL) return { url: PLAY_STORE_URL, label: 'Google Play' }
  return null
}

function dismissedNow(): boolean {
  try {
    const until = Number(window.localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

/**
 * 웹판을 휴대폰 브라우저로 볼 때 화면 맨 위에 붙는 앱 설치 안내(Safari 기본 배너와 같은 자리·모양).
 * 겹쳐 띄우지 않고 화면을 그만큼 아래로 민다. 닫으면 14일 동안 숨긴다(브라우저 저장소, 못 쓰면 이번 방문만).
 * 앱이 깔려 있으면 스토어 화면에 '열기'가 나온다.
 */
export default function WebAppInstallBanner() {
  const [store] = useState(pickStore)
  const [hidden, setHidden] = useState(() => store === null || dismissedNow())
  if (!store || hidden) return null

  const dismiss = () => {
    setHidden(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000))
    } catch {
      // 저장소를 못 쓰면(사생활 보호 모드 등) 이번 방문 동안만 숨긴다.
    }
  }

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
  icon: { width: 36, height: 36, borderRadius: 8 },
  texts: { flex: 1, minWidth: 0 },
  title: { fontFamily: FONTS.semibold, fontSize: 13.5, color: COLORS.textPrimary },
  sub: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  cta: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.white },
})
