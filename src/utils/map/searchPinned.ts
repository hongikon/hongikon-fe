import type { Partner } from '../../types'

/** 검색 창 맨 위에 모아 보일 업체 묶음. */
export interface SearchPinnedSection {
  title: string
  hint: string
  partners: Partner[]
}

/**
 * 검색 창 맨 위에 모아 보일 업체: 근처 알림으로 연 곳들이 먼저, 없으면 안내 줄의 '지도에 안 보이는 곳'. 둘 다 없으면 undefined.
 */
export function searchPinnedSection(nearbyGroup: Partner[] | null, searchPinned: Partner[] | null): SearchPinnedSection | undefined {
  if (nearbyGroup && nearbyGroup.length > 0) {
    return {
      title: '지금 계신 곳 근처 제휴',
      hint: '알림을 보낸 순간 함께 잡힌 곳이에요. 가까운 순으로, 누르면 그 가게 혜택을 볼 수 있어요.',
      partners: nearbyGroup,
    }
  }
  if (searchPinned && searchPinned.length > 0) {
    return {
      title: `지도에 안 보이는 ${searchPinned.length}곳`,
      hint: '캠퍼스에서 멀어 지도에는 핀이 안 보여요. 누르면 그 주변으로 이동해요.',
      partners: searchPinned,
    }
  }
  return undefined
}
