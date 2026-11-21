import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { OnboardingPrimaryButton } from './OnboardingButtons'
import BrandSymbol from '../../../assets/brand/symbol.svg'
import IntroSlide from './intro/IntroSlide'
import { SLIDES } from './intro/slides'
import { useIntroSlides } from '../../hooks/onboarding/useIntroSlides'

export interface IntroSlidesProps {
  /** 마지막 장에서 "시작하기" 또는 "건너뛰기"를 누르면 다음 단계(접근권한 안내, 웹은 웰컴)로 넘어간다. */
  onDone: () => void
}

/**
 * 첫 실행 소개 2~3장. 옆으로 밀어 넘기거나 "다음"을 누른다.
 * 페이지 넘김·너비가 바뀔 때 보던 장 다시 맞추기는 `hooks/onboarding/useIntroPager`, 한 장 모양(낮은 화면에서
 * 그림 줄이기)은 `intro/IntroSlide` 가 한다.
 */
export default function IntroSlides({ onDone }: IntroSlidesProps) {
  const { scrollRef, width, index, isLast, handleLayout, handleScroll, goTo, artScale, showArt, handleNext } = useIntroSlides({ onDone })

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
              <IntroSlide
                key={slide.key}
                slide={slide}
                index={i}
                count={SLIDES.length}
                width={width}
                artScale={artScale}
                showArt={showArt}
              />
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
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.toggleOff },
  dotActive: { width: 18, backgroundColor: COLORS.primary },
  bottom: { paddingHorizontal: 20, paddingBottom: 12 },
})
