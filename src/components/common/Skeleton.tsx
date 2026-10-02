import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { COLORS } from '../../constants/colors'
import { CONTENT_MAX_WIDTH } from '../../constants/layout'

/**
 * 첫 로딩 동안 실제 화면 모양을 회색 블록으로 미리 보여주는 자리표시자(스켈레톤).
 * 번쩍이는 shimmer 대신 은은하게 숨 쉬듯(opacity) 깜빡인다. 한 묶음(SkeletonGroup) 안의 블록은
 * 같은 박자로 움직이고, 기기 설정에서 "동작 줄이기"를 켰으면 움직이지 않는다.
 *
 * 다음 페이지 로딩(목록 끝 스피너)이나 당겨서 새로고침에는 쓰지 않는다 — 이미 내용이 보이고 있어서다.
 */

const PulseContext = createContext<Animated.Value | null>(null)

const BLOCK_COLOR = '#ECECEF'

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => {
      alive = false
      sub?.remove()
    }
  }, [])
  return reduce
}

/** 안의 블록들이 함께 깜빡이게 묶는다. 스크린리더에는 "불러오는 중" 하나로 읽힌다. */
export function SkeletonGroup({
  children,
  style,
  accessibilityLabel = '불러오는 중',
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const pulse = useRef(new Animated.Value(1)).current
  const reduceMotion = useReduceMotion()

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1)
      return
    }
    const useNativeDriver = Platform.OS !== 'web'
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver }),
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse, reduceMotion])

  return (
    <PulseContext.Provider value={pulse}>
      <View
        style={style}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy: true }}
      >
        {children}
      </View>
    </PulseContext.Provider>
  )
}

/** 회색 블록 하나. SkeletonGroup 안에서 쓴다. */
export function SkeletonBlock({
  width = '100%',
  height = 12,
  radius = 6,
  style,
}: {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const pulse = useContext(PulseContext)
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: BLOCK_COLOR, opacity: pulse ?? 1 },
        style,
      ]}
    />
  )
}

/** NewsCard 와 같은 크기·여백의 카드 자리표시자. */
function NewsCardSkeleton({ titleWidth }: { titleWidth: DimensionValue }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <SkeletonBlock width={34} height={18} radius={8} />
        <SkeletonBlock width={58} height={10} />
      </View>
      <SkeletonBlock width="100%" height={14} style={styles.gap6} />
      <SkeletonBlock width={titleWidth} height={14} style={styles.gap10} />
      <SkeletonBlock width="85%" height={11} style={styles.gap12} />
      <View style={styles.cardSource}>
        <SkeletonBlock width={90} height={10} />
      </View>
    </View>
  )
}

// 줄 길이가 모두 같으면 기계적으로 보여 카드마다 조금씩 다르게 둔다.
const TITLE_WIDTHS: DimensionValue[] = ['62%', '48%', '74%', '55%', '68%', '40%']

/**
 * 소식 목록 첫 로딩. NewsList 의 여백(padding 12, gap 8)과 맞췄다.
 * NewsList 의 빈 목록 자리(ListEmptyComponent)에 넣을 땐 이미 여백이 있으니 `inList` 를 준다.
 */
export function NewsListSkeleton({ count = 5, inList = false }: { count?: number; inList?: boolean }) {
  return (
    <SkeletonGroup style={inList ? styles.listInner : styles.list} accessibilityLabel="소식을 불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <NewsCardSkeleton key={i} titleWidth={TITLE_WIDTHS[i % TITLE_WIDTHS.length]} />
      ))}
    </SkeletonGroup>
  )
}

/** 소식 상세 첫 로딩(알림으로 들어와 아직 아무것도 없을 때). NewsDetailScreen 본문 배치와 맞췄다. */
export function NewsDetailSkeleton() {
  return (
    <SkeletonGroup style={styles.detail} accessibilityLabel="소식을 불러오는 중">
      <View style={styles.detailMeta}>
        <SkeletonBlock width={40} height={22} radius={8} />
        <SkeletonBlock width={96} height={11} />
      </View>
      <SkeletonBlock width="100%" height={20} radius={7} style={styles.gap8} />
      <SkeletonBlock width="70%" height={20} radius={7} style={styles.gap16} />
      <SkeletonBlock width={120} height={12} style={styles.gap20} />
      <View style={styles.detailDivider} />
      <DetailBodySkeletonLines />
      <SkeletonBlock width="100%" height={46} radius={12} style={styles.detailLink} />
    </SkeletonGroup>
  )
}

/** 상세 본문 줄들. 제목은 이미 있고 본문만 받는 중일 때도 쓴다. */
export function DetailBodySkeleton() {
  return (
    <SkeletonGroup accessibilityLabel="본문을 불러오는 중" style={styles.gap20}>
      <DetailBodySkeletonLines />
    </SkeletonGroup>
  )
}

function DetailBodySkeletonLines() {
  return (
    <View style={styles.bodyLines}>
      <SkeletonBlock width="100%" height={13} />
      <SkeletonBlock width="96%" height={13} />
      <SkeletonBlock width="88%" height={13} />
      <SkeletonBlock width="93%" height={13} />
      <SkeletonBlock width="60%" height={13} />
    </View>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, padding: 12, gap: 8, backgroundColor: COLORS.background },
  listInner: { gap: 8 },
  // 실제 목록(NewsList)처럼 넓은 화면에선 가운데 읽기 폭에서 멈춘다(목록 좌우 padding 12 를 뺀 폭).
  card: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH - 24,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardSource: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.divider },
  gap6: { marginBottom: 6 },
  gap8: { marginBottom: 8 },
  gap10: { marginBottom: 10 },
  gap12: { marginBottom: 12 },
  gap16: { marginBottom: 16 },
  gap20: { marginBottom: 20 },
  detail: { padding: 20, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  detailMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  detailDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginBottom: 20 },
  bodyLines: { gap: 11 },
  detailLink: { marginTop: 28 },
})
