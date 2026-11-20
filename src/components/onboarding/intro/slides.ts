import type { ComponentProps } from 'react'
import type OnboardingIllustration from '../OnboardingIllustration'
import type { IllustrationBadge } from '../OnboardingIllustration'

type IconName = ComponentProps<typeof OnboardingIllustration>['icon']

export interface Slide {
  key: string
  icon: IconName
  badges: readonly [IllustrationBadge, IllustrationBadge]
  title: string
  body: string
}

/** 첫 실행 소개 장들(지도·공지·제보). */
export const SLIDES: readonly Slide[] = [
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
    body: '구독한 게시판의 공지를 한곳에 모아 보여주고\n새 공지는 알림으로 알려드려요.',
  },
  {
    key: 'report',
    icon: 'megaphone',
    badges: [
      { icon: 'flash-outline', label: '캠퍼스 제보' },
      { icon: 'storefront-outline', label: '정보 제보' },
    ],
    title: '캠퍼스 소식은\n함께 만들어요',
    body: '로그인하면 누구나 캠퍼스 상황과 제휴·행사 정보를\n제보할 수 있어요(운영진 확인 후 표시).',
  },
]
