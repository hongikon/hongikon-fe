import type { ExternalLink, PartnerAffiliation } from '../types'

/**
 * 소속별 제휴 정보의 근거 자료. `PARTNERS` 의 좌표·혜택은 여기 적힌 출처를
 * 보고 옮겨 적은 값이라, 잘못된 내용이 있으면 이 출처부터 다시 확인한다.
 *
 * 아직 출처를 확인받지 못한 소속은 목록에 넣지 않는다. 설정 화면에서는
 * 여기 없는 소속이 자동으로 빠진다.
 */
export interface PartnerSource {
  affiliation: PartnerAffiliation
  /** 제휴 유효기간. 확인되지 않았으면 비워둔다. */
  period?: string
  links: ExternalLink[]
}

export const PARTNER_SOURCES: readonly PartnerSource[] = [
  {
    // 개별 게시물이 아니라 계정 자체가 출처로 제공되었다.
    affiliation: '총학생회',
    links: [
      { label: '제휴 안내 계정 (hongik_chance)', url: 'https://www.instagram.com/hongik_chance/' },
    ],
  },
  {
    affiliation: '캠퍼스자율전공(서울)',
    period: '2026.03.19 ~ 2026.12.31',
    links: [
      { label: '제휴 안내 게시물 1', url: 'https://www.instagram.com/p/DWDGPnGElSW/' },
      { label: '제휴 안내 게시물 2', url: 'https://www.instagram.com/p/DWDGxJdEmJ7/' },
      { label: '제휴 안내 게시물 3', url: 'https://www.instagram.com/p/DWDHIA9kqqI/' },
    ],
  },
  {
    affiliation: '경영대학',
    period: '2026.09.01 ~ 2026.12.14',
    links: [
      { label: '제휴 안내 게시물 1', url: 'https://www.instagram.com/p/DV4shxSkmxP/' },
      { label: '제휴 안내 게시물 2', url: 'https://www.instagram.com/p/DVQPhkWEs9O/' },
      { label: '제휴 안내 게시물 3', url: 'https://www.instagram.com/p/DVQh4AyElrA/' },
      { label: '제휴 안내 게시물 4', url: 'https://www.instagram.com/p/DVS0w5FEj5x/' },
      { label: '제휴 안내 게시물 5', url: 'https://www.instagram.com/p/DVTCALfEjeL/' },
    ],
  },
  {
    // 개별 게시물이 아니라 하이라이트(스토리 모음)가 출처로 제공되었다.
    affiliation: '공과대학',
    links: [
      {
        label: '제휴 안내 하이라이트',
        url: 'https://www.instagram.com/stories/highlights/18567852643031078/',
      },
    ],
  },
  {
    affiliation: '문과대학',
    links: [
      { label: '제휴 안내 게시물 1', url: 'https://www.instagram.com/p/DZcB4GTEp2W/' },
      { label: '제휴 안내 게시물 2', url: 'https://www.instagram.com/p/DWSp_wNEotb/' },
    ],
  },
]
