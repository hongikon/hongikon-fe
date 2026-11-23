import { useCallback, useMemo, useRef, useState } from 'react'
import type { PickerCenter, PickerPurpose } from '../../utils/map/picker/locationPickerOverlay'
import type { InfoSuggestLocation } from '../../components/settings/InfoSuggestModal'
import type { Building } from '../../types'
import { routePinBuilding } from '../../utils/map/route/routePinBuilding'

interface Options {
  postToMap: (msg: object) => void
  buildings: readonly Building[]
  /** 고르기를 시작할 때(다른 시트를 모두 닫는 등). */
  onStart?: () => void
  /** '이 위치 제보하기'. */
  onConfirmReport: (center: PickerCenter) => void
  /** '이 위치로 정보 제보'. */
  onConfirmPartner: (center: PickerCenter) => void
  /** '여기로 도착'(핀 아래 건물). */
  onConfirmRouteTo: (building: Building) => void
  /** 정보 제보 중에 취소하면 그 창으로 돌아간다. 창에 있던 위치(없으면 null)를 넘긴다. */
  onCancelPartner: (previous: InfoSuggestLocation | null) => void
}

/**
 * 지도 가운데 고정 핀으로 위치 고르기: 제보(report), 정보 제보(partner), 길찾기 도착 건물(routeTo, 11-12).
 * 지도를 움직이면 지도 페이지가 'pickerCenter' 로 가운데 좌표(와 가까운 건물 이름)를 알려 준다(handleCenterMessage).
 */
export function useLocationPicker({ postToMap, buildings, ...callbacks }: Options) {
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const [picking, setPicking] = useState(false)
  const [purpose, setPurpose] = useState<PickerPurpose>('report')
  const [center, setCenter] = useState<PickerCenter | null>(null)
  /** 정보 제보 창에서 '지도에서 (다시) 찍기'로 넘어올 때 그 창에 있던 위치. 고르기를 취소하면 되돌린다. */
  const partnerLocationBeforeRef = useRef<InfoSuggestLocation | null>(null)

  /** 길찾기 도착을 핀으로 고를 때 그 핀이 가리키는 건물(핀 아래, 없으면 150m 안 가장 가까운 건물). */
  const routeTarget = useMemo(
    () => (purpose === 'routeTo' && center ? routePinBuilding(center, buildings) : null),
    [purpose, center, buildings],
  )

  /** 고르기 시작. 다른 시트를 닫고 지도 페이지에 가운데 좌표를 알려 달라고 한다. */
  const start = useCallback(
    (next: PickerPurpose, options: { partnerLocationBefore?: InfoSuggestLocation | null } = {}) => {
      if (options.partnerLocationBefore !== undefined) partnerLocationBeforeRef.current = options.partnerLocationBefore
      callbacksRef.current.onStart?.()
      setCenter(null)
      setPurpose(next)
      setPicking(true)
      postToMap({ type: 'startLocationPicker', purpose: next })
    },
    [postToMap],
  )

  /** 고르기를 끈다. 취소 버튼과, 고르는 중에 다른 지도 요청(알림 제보·검토 핀)이 들어올 때 쓴다. */
  const stop = useCallback(() => {
    setPicking(false)
    setCenter(null)
    postToMap({ type: 'stopLocationPicker' })
  }, [postToMap])

  /** 취소. 정보 제보 중이었으면 그 창으로 돌아간다(입력해 둔 내용은 창이 되살린다). 안 그러면 쓰던 제보가 사라진다. */
  const cancel = useCallback(() => {
    stop()
    if (purpose === 'partner') callbacksRef.current.onCancelPartner(partnerLocationBeforeRef.current)
  }, [purpose, stop])

  /** 확인. 목적에 따라 제보 쓰기·정보 제보 창·도착 정하기로 이어 간다. */
  const confirm = useCallback(() => {
    if (!center) return
    if (purpose === 'routeTo' && !routeTarget) return
    setPicking(false)
    postToMap({ type: 'stopLocationPicker' })
    if (purpose === 'routeTo') callbacksRef.current.onConfirmRouteTo(routeTarget!)
    else if (purpose === 'partner') callbacksRef.current.onConfirmPartner(center)
    else callbacksRef.current.onConfirmReport(center)
  }, [center, purpose, routeTarget, postToMap])

  /** 지도 페이지의 'pickerCenter' 메시지(지도가 멈출 때마다). */
  const handleCenterMessage = useCallback((msg: { lat: number; lng: number; buildingName?: string | null }) => {
    setCenter({ lat: msg.lat, lng: msg.lng, buildingName: msg.buildingName ?? null })
  }, [])

  /** 지도 페이지가 다시 떴을 때 고르는 중이면 고르기를 다시 켠다(새 페이지는 고르기 상태를 모른다). */
  const resync = useCallback(() => {
    if (!picking) return
    setCenter(null)
    postToMap({ type: 'startLocationPicker', purpose })
  }, [picking, purpose, postToMap])

  return { picking, purpose, center, routeTarget, start, stop, cancel, confirm, handleCenterMessage, resync }
}
