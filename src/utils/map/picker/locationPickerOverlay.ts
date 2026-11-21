import { CAMPUS_CENTER } from '../../../constants/map'
import { REPORT_OFF_CAMPUS_MAX_METERS } from '../../../constants/report'
import { haversineMeters } from '../../common/geo'

/** report: 제보, partner: 정보 제보(설정의 정보 제보 창), routeTo: 길찾기 도착 건물을 핀으로. */
export type PickerPurpose = 'report' | 'partner' | 'routeTo'

export interface PickerCenter {
  lat: number
  lng: number
  buildingName: string | null
}

/** 아래 카드의 위치 문구. */
export function locationText(purpose: PickerPurpose, center: PickerCenter | null, routeBuildingName: string | null): string {
  if (!center) return '위치 확인 중...'
  if (purpose === 'routeTo') return routeBuildingName ? `도착: ${routeBuildingName}` : '근처에 길찾기할 수 있는 건물이 없어요'
  if (center.buildingName) return `${center.buildingName} 근처`
  if (purpose === 'report') {
    // 캠퍼스 밖 제보(10-27): 홍대 생활권 안이면 장소를 직접 적어 올리고, 더 멀면 올릴 수 없다고 미리 알린다.
    return haversineMeters(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng, center.lat, center.lng) <= REPORT_OFF_CAMPUS_MAX_METERS
      ? '캠퍼스 밖 · 다음 화면에서 장소를 적어 주세요'
      : `캠퍼스에서 ${REPORT_OFF_CAMPUS_MAX_METERS / 1000}km 밖은 제보할 수 없어요`
  }
  return `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
}
