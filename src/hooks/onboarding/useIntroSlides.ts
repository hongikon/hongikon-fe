import { useCallback } from 'react'
import { useIntroPager } from './useIntroPager'
import { introArtScale } from '../../utils/onboarding/intro/introSlide'
import { SLIDES } from '../../components/onboarding/intro/slides'
import type { IntroSlidesProps } from '../../components/onboarding/IntroSlides'

/** IntroSlides 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useIntroSlides({ onDone }: Pick<IntroSlidesProps, 'onDone'>) {
  const { scrollRef, width, height, index, isLast, handleLayout, handleScroll, goTo } = useIntroPager(SLIDES.length)
  const { artScale, showArt } = introArtScale(height)

  const handleNext = useCallback(() => {
    if (isLast) onDone()
    else goTo(index + 1)
  }, [isLast, onDone, goTo, index])
  return { scrollRef, width, index, isLast, handleLayout, handleScroll, goTo, artScale, showArt, handleNext }
}
