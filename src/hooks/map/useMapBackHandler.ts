import { useCallback, useRef } from 'react'
import { BackHandler, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { Building, Partner, ReportListItem } from '../../types'

interface Options {
  /** 검색·작성·길찾기·정보 제보 창이 떠 있는지. 떠 있으면 그 창이 먼저 닫혀야 해서 시트는 건드리지 않는다. */
  windowOpen: boolean
  pickingLocation: boolean
  cancelPicker: () => void
  selectedReport: ReportListItem | null
  selectedPartner: Partner | null
  selectedBuilding: Building | null
  selectedFacilityBuilding: string | null
  facilityKind: string | null
  /** 건물에서 들어간 시설 시트면 truthy. */
  facilityFrom: unknown
  closeReportSheet: () => void
  closePartnerSheet: () => void
  closeBuildingSheet: () => void
  closeFacilitySheet: () => void
  backToBuilding: () => void
}

/**
 * 안드로이드 뒤로가기(웹은 Esc)는 위치 고르기·열린 시트부터 닫는다. 시트·고르기는 화면 안 상태라 내비게이션이
 * 모르고, 지도가 첫 탭이라 그냥 두면 앱이 꺼진다. 닫기(X)와 똑같은 처리를 쓴다. 닫을 게 없으면 기본 동작에 맡긴다.
 * 어느 층이 먼저 닫히는지(창 > 위치 고르기 > 제보 > 제휴 > 시설 > 건물)가 여기서 정해진다.
 */
function useCloseTopMapLayer(options: Options) {
  const latestRef = useRef(options)
  latestRef.current = options
  return useCallback((): boolean => {
    const o = latestRef.current
    // 검색·작성·길찾기 창이 떠 있으면 그 창이 먼저 닫혀야 한다(웹 Esc 가 아래 시트까지 닫지 않게).
    if (o.windowOpen) return false
    if (o.pickingLocation) {
      o.cancelPicker()
      return true
    }
    if (o.selectedReport) {
      o.closeReportSheet()
      return true
    }
    if (o.selectedPartner) {
      o.closePartnerSheet()
      return true
    }
    if (o.selectedFacilityBuilding !== null && o.facilityKind !== null) {
      // 건물에서 들어간 시설 시트면 '뒤로'는 그 건물 시트로(시트의 '<'와 같다, 11-08).
      if (o.facilityFrom) o.backToBuilding()
      else o.closeFacilitySheet()
      return true
    }
    if (o.selectedBuilding) {
      o.closeBuildingSheet()
      return true
    }
    return false
  }, [])
}

/**
 * 지도 탭에 있는 동안 안드로이드 뒤로가기(웹은 Esc)를 가장 위 층 닫기로 보낸다. 무언가 닫았으면 true 를
 * 돌려주고, 닫을 게 없으면 false — 그러면 기본 동작(앱 나가기 등)에 맡긴다.
 * 웹 Esc 는 입력 칸에서 누른 것이나 이미 처리된 것은 건드리지 않는다(검색·작성창이 먼저 닫히게).
 */
export function useMapBackHandler(options: Options) {
  const closeTopLayer = useCloseTopMapLayer(options)
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        const sub = BackHandler.addEventListener('hardwareBackPress', closeTopLayer)
        return () => sub.remove()
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const onKey = (e: KeyboardEvent) => {
          if (e.key !== 'Escape' || e.defaultPrevented) return
          const target = e.target as HTMLElement | null
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
          if (closeTopLayer()) e.preventDefault()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }
      return undefined
    }, [closeTopLayer]),
  )
}
