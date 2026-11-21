import type { InfoSuggestLocation, InfoSuggestPrefill } from '../../../components/settings/InfoSuggestModal'
import type { Partner } from '../../../types'

/** 제휴 시트의 '정보 수정': 그 가게의 위치와, 정보 제보 창을 '정보 수정'으로 열 때 채울 이름·주소·소속. */
export function partnerEditSuggestion(partner: Partner): { location: InfoSuggestLocation; prefill: InfoSuggestPrefill } {
  return {
    location: { lat: partner.lat, lng: partner.lng, buildingName: null },
    prefill: {
      type: 'partner',
      kind: 'fix',
      name: partner.name,
      address: partner.address ?? '',
      affiliation: partner.affiliations?.[0] ?? null,
    },
  }
}
