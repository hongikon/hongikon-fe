import { ILLUSTRATION_SIZE } from '../../../components/onboarding/OnboardingIllustration'

/** 그림 아래 여백. */
export const ART_GAP = 40

export const ART_BLOCK = ILLUSTRATION_SIZE + ART_GAP

/** 제목 두 줄 + 설명 두 줄 + 위아래 숨 쉴 틈. */
export const ART_TEXT_RESERVE = 190

/**
 * 높이가 낮은 화면(플립 커버 화면, 가로로 눕힌 창)에선 그림을 줄여 제목·설명이 잘리지 않게 한다.
 * 글자 영역(약 190dp)을 먼저 확보하고 남는 높이에 맞춰 그림만 줄인다.
 * 0.4배보다 작아질 만큼 낮으면(가로로 눕힌 작은 창 등) 그림을 아예 뺀다.
 */
export function introArtScale(pagerHeight: number): { artScale: number; showArt: boolean } {
  const artScale = pagerHeight ? Math.min(1, (pagerHeight - ART_TEXT_RESERVE) / ART_BLOCK) : 1
  return { artScale, showArt: artScale >= 0.4 }
}
