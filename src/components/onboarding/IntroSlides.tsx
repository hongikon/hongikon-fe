import { useCallback, useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import OnboardingIllustration, { ILLUSTRATION_SIZE, type IllustrationBadge } from './OnboardingIllustration'
import { OnboardingPrimaryButton } from './OnboardingButtons'
import BrandSymbol from '../../../assets/brand/symbol.svg'

type IconName = ComponentProps<typeof OnboardingIllustration>['icon']

interface Slide {
  key: string
  icon: IconName
  badges: readonly [IllustrationBadge, IllustrationBadge]
  title: string
  body: string
}

const SLIDES: readonly Slide[] = [
  {
    key: 'map',
    icon: 'map',
    badges: [
      { icon: 'cafe-outline', label: '편의시설' },
      { icon: 'pricetag-outline', label: '제휴 혜택' },
    ],
    title: '캠퍼스 지도로\n찾는 곳을 바로',
    body: '건물·층별 편의시설과 학교 앞 제휴 가게를\n지도에서 한눈에 볼 수 있어요.',
  },
  {
    key: 'news',
    icon: 'notifications',
    badges: [
      { icon: 'school-outline', label: '학과 공지' },
      { icon: 'ribbon-outline', label: '장학·학사' },
    ],
    title: '학과·학교 공지를\n놓치지 않게',
    body: '구독한 게시판의 새 공지를 모아 보여주고\n올라오는 즉시 알림으로 알려드려요.',
  },
  {
    key: 'report',
    icon: 'megaphone',
    badges: [
      { icon: 'flash-outline', label: '실시간 제보' },
      { icon: 'storefront-outline', label: '제휴 제보' },
    ],
    title: '캠퍼스 소식은\n함께 만들어요',
    body: '지금 캠퍼스 상황과 새로 생긴 제휴 가게를\n누구나 바로 제보할 수 있어요.',
  },
]

interface IntroSlidesProps {
  /** 마지막 장에서 "시작하기" 또는 "건너뛰기"를 누르면 다음 단계(학과 고르기)로 넘어간다. */
  onDone: () => void
}

/**
 * 첫 실행 소개 2~3장. 옆으로 밀어 넘기거나 "다음"을 누른다.
 * 페이지 넘김은 가로 ScrollView 의 pagingEnabled 로 한다 — 웹(react-native-web)도 scroll-snap 으로 같은 동작을 한다.
 * 너비는 화면 너비가 아니라 실제로 그려진 영역 너비(onLayout)를 쓴다. 웹에서 앱 영역이 창보다 좁을 수 있어서다.
 *
 * 폴드를 접고 펴거나(앱이 다시 시작되지 않고 창 크기만 바뀐다) 웹 창 크기를 바꾸면 너비가 달라진다.
 * 그때 스크롤 위치는 옛 너비 기준으로 남아 두 장 사이에 걸치므로, 보던 장으로 다시 맞춘다.
 * 높이가 낮은 화면(플립 커버 화면, 가로로 눕힌 창)에선 그림을 줄여 제목·설명이 잘리지 않게 한다.
 */
export default function IntroSlides({ onDone }: IntroSlidesProps) {
  const scrollRef = useRef<ScrollView>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const { width, height } = size
  const [index, setIndex] = useState(0)
  // 너비가 바뀐 직후 다시 맞출 때 쓰는 "지금 보던 장". state 는 스크롤 이벤트가 먼저 덮어쓸 수 있어 따로 둔다.
  const indexRef = useRef(0)
  const isLast = index === SLIDES.length - 1

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const next = {
      width: Math.round(e.nativeEvent.layout.width),
      height: Math.round(e.nativeEvent.layout.height),
    }
    setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next))
  }, [])

  // 너비가 바뀌면 보던 장의 시작점으로 스크롤을 옮긴다(애니메이션 없이). 처음 그릴 때(0번 장)는 그대로다.
  useLayoutEffect(() => {
    if (!width) return
    scrollRef.current?.scrollTo({ x: indexRef.current * width, animated: false })
  }, [width])

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!width) return
      const next = Math.max(
        0,
        Math.min(SLIDES.length - 1, Math.round(e.nativeEvent.contentOffset.x / width)),
      )
      indexRef.current = next
      setIndex(next)
    },
    [width],
  )

  const goTo = useCallback(
    (next: number) => {
      scrollRef.current?.scrollTo({ x: next * width, animated: true })
      indexRef.current = next
      setIndex(next)
    },
    [width],
  )

  // 글자 영역(약 190dp)을 먼저 확보하고 남는 높이에 맞춰 그림만 줄인다.
  // 0.4배보다 작아질 만큼 낮으면(가로로 눕힌 작은 창 등) 그림을 아예 빼서 제목·설명이 잘리지 않게 한다.
  const artScale = height ? Math.min(1, (height - ART_TEXT_RESERVE) / ART_BLOCK) : 1
  const showArt = artScale >= 0.4

  const handleNext = useCallback(() => {
    if (isLast) onDone()
    else goTo(index + 1)
  }, [isLast, onDone, goTo, index])

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <BrandSymbol width={28} height={28} accessibilityLabel="HONGIK ON" />
        {!isLast && (
          <Pressable
            onPress={onDone}
            hitSlop={10}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="소개 건너뛰기"
          >
            <Text style={styles.skipText}>건너뛰기</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.pager} onLayout={handleLayout}>
        {width > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            bounces={false}
          >
            {SLIDES.map((slide, i) => (
              <View
                key={slide.key}
                style={[styles.slide, { width }]}
                accessibilityLabel={`${i + 1}/${SLIDES.length}. ${slide.title.replace('\n', ' ')}`}
              >
                {showArt && (
                <View
                  style={[
                    styles.art,
                    {
                      width: ILLUSTRATION_SIZE * artScale,
                      height: ILLUSTRATION_SIZE * artScale,
                      marginBottom: ART_GAP * artScale,
                    },
                  ]}
                >
                  <View style={{ transform: [{ scale: artScale }] }}>
                    <OnboardingIllustration icon={slide.icon} badges={slide.badges} />
                  </View>
                </View>
                )}
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.body}>{slide.body}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.dots} accessibilityLabel={`${SLIDES.length}장 중 ${index + 1}번째`}>
        {SLIDES.map((slide, i) => (
          <Pressable key={slide.key} onPress={() => goTo(i)} hitSlop={6} accessibilityElementsHidden>
            <View style={[styles.dot, i === index && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.bottom}>
        <OnboardingPrimaryButton label={isLast ? '시작하기' : '다음'} onPress={handleNext} />
      </View>
    </View>
  )
}

/** 그림 아래 여백. */
const ART_GAP = 40
const ART_BLOCK = ILLUSTRATION_SIZE + ART_GAP
/** 제목 두 줄 + 설명 두 줄 + 위아래 숨 쉴 틈. */
const ART_TEXT_RESERVE = 190

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skip: { paddingVertical: 6, paddingHorizontal: 4 },
  skipText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  pressed: { opacity: 0.6 },
  pager: { flex: 1 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  art: { alignItems: 'center', justifyContent: 'center' },
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
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D9D9E0' },
  dotActive: { width: 18, backgroundColor: COLORS.primary },
  bottom: { paddingHorizontal: 20, paddingBottom: 12 },
})
