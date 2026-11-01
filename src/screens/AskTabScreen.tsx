import { useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AskChat from '../components/ask/AskChat'
import Button from '../components/common/Button'
import ContentColumn from '../components/common/ContentColumn'
import { getAskStatus, type AskStatus } from '../apis/ask'
import { useAuth } from '../contexts/AuthContext'
import { COLORS } from '../constants/colors'
import { FONTS, TYPE } from '../constants/typography'
import { RADIUS, SPACING } from '../constants/spacing'
import { TAB_BAR_BASE_STYLE } from '../navigation/tabBarStyles'

/** 처음 쓸 때 받는 동의(국외 이전·대화 기록). 문구가 바뀌면 판을 올려 다시 묻는다. */
const CONSENT_KEY = 'ask.consent.v1'

/**
 * 하단 '물어보기' 탭(BETA, 11-01 — docs/ask-tab-plan.md). 탭은 모두에게 보이고, 질문은 로그인한 사용자만.
 * 처음 한 번 동의(질문이 Anthropic(미국)으로 전송·1년 기록)를 받은 뒤 AskChat 을 로그인 토큰으로 연다.
 * 서버 스위치가 꺼져 있으면 쉬는 중이라고만 보인다. 입력하는 동안은 떠 있는 탭 바를 숨겨 입력줄과 겹치지 않게 한다.
 */
export default function AskTabScreen() {
  const { status, accessToken, logout } = useAuth()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const loggedIn = status === 'authenticated' && !!accessToken
  const [consented, setConsented] = useState<boolean | null>(null)
  const [askStatus, setAskStatus] = useState<AskStatus | null>(null)
  const [keyboardShown, setKeyboardShown] = useState(false)
  const statusAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(CONSENT_KEY)
      .then((value) => setConsented(value === 'yes'))
      .catch(() => setConsented(false))
  }, [])

  const refreshStatus = useCallback(() => {
    statusAbort.current?.abort()
    const abort = new AbortController()
    statusAbort.current = abort
    getAskStatus(loggedIn ? accessToken : null, abort.signal)
      .then((next) => {
        if (!abort.signal.aborted) setAskStatus(next)
      })
      .catch(() => {})
  }, [loggedIn, accessToken])

  useFocusEffect(
    useCallback(() => {
      refreshStatus()
      return () => statusAbort.current?.abort()
    }, [refreshStatus]),
  )

  // 키보드가 올라오면 탭 바를 숨긴다(떠 있는 캡슐이 입력줄을 가린다). 이 탭을 떠나면 원래대로.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, () => setKeyboardShown(true))
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardShown(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: keyboardShown ? { display: 'none' } : TAB_BAR_BASE_STYLE })
  }, [navigation, keyboardShown])

  const accept = () => {
    setConsented(true)
    AsyncStorage.setItem(CONSENT_KEY, 'yes').catch(() => {})
  }

  if (askStatus && !askStatus.enabled) {
    return (
      <Notice
        topInset={insets.top}
        icon="moon-outline"
        title="지금은 물어보기를 쉬고 있어요"
        body="곧 다시 열게요. 학교 공지는 소식 탭에서 볼 수 있어요."
      />
    )
  }

  if (!loggedIn) {
    return (
      <Notice
        topInset={insets.top}
        icon="chatbubble-ellipses-outline"
        title="학교 일, 물어보세요"
        body="휴학·수강·장학·시설처럼 학교 일을 물으면 학교 공식 안내를 찾아 답해요. 로그인하면 쓸 수 있어요."
        action={{ label: '로그인하러 가기', onPress: () => void logout() }}
      />
    )
  }

  if (consented === null) return <View style={styles.root} />

  if (!consented) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + SPACING.md }]}>
        <ScrollView contentContainerStyle={styles.consentScroll}>
          <ContentColumn>
            <View style={styles.titleRow}>
              <Text style={styles.title}>물어보기</Text>
              <Text style={styles.beta}>BETA</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>시작하기 전에 확인해 주세요</Text>
              <Bullet text="학교 홈페이지 안내와 공지를 근거로 AI가 답해요. 시험 중인 기능이라 틀릴 수 있으니, 중요한 일정·조건은 답 아래 원문 링크나 담당 부서로 꼭 확인해 주세요." />
              <Bullet text="답을 쓰기 위해 질문과 직전 대화가 Anthropic(미국)의 AI 서버로 암호화되어 전송돼요." />
              <Bullet text="서비스 개선을 위해 질문·답·'해결됐나요' 응답을 1년 동안 보관해요. 계정과 연결하지 않고, 학번·전화번호·이메일 형태는 가려서 저장해요." />
              <Bullet text="학번·연락처 같은 개인정보는 질문에 적지 말아 주세요." />
              <Bullet text="동의하지 않아도 다른 기능은 그대로 쓸 수 있어요." />
            </View>
            <Button label="동의하고 시작하기" onPress={accept} />
          </ContentColumn>
        </ScrollView>
      </View>
    )
  }

  const note = !askStatus
    ? null
    : askStatus.soldOut
      ? '오늘 준비한 질문이 모두 찼어요. 내일 다시 물어봐 주세요.'
      : `오늘 ${askStatus.remaining}번 더 물어볼 수 있어요`

  return (
    <View style={styles.root}>
      <AskChat
        accessToken={accessToken}
        beta
        bottomInset={keyboardShown ? insets.bottom : tabBarHeight}
        composerNote={note}
        onAsked={refreshStatus}
      />
    </View>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.dot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

function Notice({
  topInset,
  icon,
  title,
  body,
  action,
}: {
  topInset: number
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
  action?: { label: string; onPress: () => void }
}) {
  return (
    <View style={[styles.root, styles.center, { paddingTop: topInset }]}>
      <ContentColumn style={styles.noticeColumn}>
        <View style={styles.noticeIcon}>
          <Ionicons name={icon} size={30} color={COLORS.primary} />
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.noticeBody}>{body}</Text>
        <Text style={styles.betaNote}>물어보기는 BETA(시험 운영) 기능이에요.</Text>
        {action ? (
          <View style={styles.noticeAction}>
            <Button label={action.label} onPress={action.onPress} />
          </View>
        ) : null}
      </ContentColumn>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center' },
  consentScroll: { paddingHorizontal: SPACING.lg, paddingBottom: 140, gap: SPACING.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: SPACING.md },
  title: { ...TYPE.title, color: COLORS.textPrimary },
  beta: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: 12, marginBottom: SPACING.lg },
  cardTitle: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  bullet: { flexDirection: 'row', gap: 8 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.textTertiary, marginTop: 8 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  noticeColumn: { alignItems: 'center', paddingHorizontal: SPACING.xl, paddingBottom: 120 },
  noticeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
  },
  noticeBody: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  betaNote: { marginTop: SPACING.sm, fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: 'center' },
  noticeAction: { marginTop: SPACING.lg, alignSelf: 'stretch' },
})
