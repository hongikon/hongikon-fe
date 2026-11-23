import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import OnboardingIllustration, { ILLUSTRATION_SIZE } from '../OnboardingIllustration'
import type { Slide } from './slides'
import { ART_GAP } from '../../../utils/onboarding/intro/introSlide'

interface Props {
  slide: Slide
  /** 몇 번째 장인지(0부터)와 전체 장 수. 읽어 주는 이름에 쓴다. */
  index: number
  count: number
  /** 페이지 한 장 너비(그려진 영역 너비). */
  width: number
  artScale: number
  showArt: boolean
}

/** [소개 한 장] 그림(줄여 그리거나 뺄 수 있음)과 제목·설명. */
export default function IntroSlide({ slide, index, count, width, artScale, showArt }: Props) {
  return (
    <View
      style={[styles.slide, { width }]}
      accessibilityLabel={`${index + 1}/${count}. ${slide.title.replace('\n', ' ')}`}
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
  )
}

const styles = StyleSheet.create({
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
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
})
