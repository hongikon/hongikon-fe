import { useCallback, useMemo, useState } from 'react'
import { unresolvedFacilities } from '../../utils/facilities'
import { filterPartners, hasActiveFilter, partnersOutsideFocus, type PartnerFilter } from '../../utils/partners'
import type { Building, Facility, FacilityKind, Partner } from '../../types'

interface Options {
  partners: readonly Partner[]
  activeFilter: PartnerFilter
  facilities: readonly Facility[]
  buildings: readonly Building[]
  facilityKind: FacilityKind | null
}

/**
 * 지도 위 안내 줄 상태: 네이버 지도 인증 실패 여부, 사용자가 닫은 안내 줄 기록,
 * 지금 필터에서 "지도에 안 보이는 N곳"·"건물을 찾지 못한 편의시설 N곳" 안내에 쓰는 수.
 */
export function useMapNotices({ partners, activeFilter, facilities, buildings, facilityKind }: Options) {
  // 네이버 지도 인증 실패. 실패해도 지도는 빈 화면으로만 남아, 알리지 않으면
  // 사용자가 앱이 멈춘 것으로 오해한다.
  const [mapAuthFailed, setMapAuthFailed] = useState(false)
  const reportMapAuthFailure = useCallback(() => setMapAuthFailed(true), [])
  const dismissMapAuthError = useCallback(() => setMapAuthFailed(false), [])

  /**
   * 지도 위 안내 줄(캠퍼스 밖 N곳 등)을 탭하거나 X 로 닫은 기록. 문구 단위로 기억해, 숫자가 바뀌는 등
   * 내용이 달라지면 다시 보여 준다. 앱을 다시 켜면 초기화된다.
   */
  const [dismissedNotices, setDismissedNotices] = useState<ReadonlySet<string>>(() => new Set())
  const dismissNotice = useCallback((message: string) => {
    setDismissedNotices((prev) => new Set(prev).add(message))
  }, [])

  const visiblePartners = useMemo(
    () => (hasActiveFilter(activeFilter) ? filterPartners(partners, activeFilter) : []),
    [partners, activeFilter],
  )
  /** 지금 필터에 걸렸지만 지도 화면 범위 밖이라 핀이 잘 안 보이는 업체들(구로·강남·성수 등). 안내 배지의 지점 수도 여기서 센다. */
  const offscreenPartners = useMemo(() => partnersOutsideFocus(visiblePartners), [visiblePartners])

  /**
   * 건물명이 지도 데이터의 건물과 안 맞아 좌표를 못 찾은 편의시설 수.
   * 조용히 빠지면 데이터를 넣었는데 지도에 안 뜨는 이유를 알 수 없어 알린다.
   */
  const unresolvedCount = useMemo(
    () => (facilityKind === null ? 0 : unresolvedFacilities(facilities, buildings).filter((f) => f.kind === facilityKind).length),
    [facilities, buildings, facilityKind],
  )

  return { offscreenPartners, unresolvedCount, mapAuthFailed, reportMapAuthFailure, dismissMapAuthError, dismissedNotices, dismissNotice }
}
