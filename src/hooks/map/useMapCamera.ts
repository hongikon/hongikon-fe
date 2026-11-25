import { useCallback, useEffect, type RefObject } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { CAMPUS_CENTER, DEFAULT_ZOOM } from '../../constants/map'
import { CAMPUS_VIEW_BOX, viewBoundsScript } from '../../utils/map/mapBounds'
import type { Partner } from '../../types'

interface Options {
  webViewRef: RefObject<NaverMapViewHandle | null>
  /** 지금 지도 이동 범위가 먼 제휴 지점 둘레면 그 지점 id, 캠퍼스 일대면 null(`mapBounds.ts`). */
  farViewPartnerIdRef: RefObject<string | null>
  selectedPartner: Partner | null
}

/**
 * 지도 카메라 되돌리기. 캠퍼스로 돌아가는 recenter 를 만들고, 그걸 부르는 두 곳을 건다:
 * 이미 지도 탭에 있을 때 하단 탭을 다시 누를 때, 먼 지점 시트가 닫히거나 다른 것이 골라졌을 때.
 */
export function useMapCamera({ webViewRef, farViewPartnerIdRef, selectedPartner }: Options) {
  const navigation = useNavigation()

  /**
   * "캠퍼스로 돌아가기". 지도를 처음 위치(캠퍼스 중심·기본 줌)로 되돌린다. GPS 는 쓰지 않는다.
   * 이미 배포된 원격 map.html 에도 바로 먹히도록 새 메시지 타입 대신 페이지 전역 `map` 을 직접 움직인다.
   */
  const recenter = useCallback(() => {
    // 먼 제휴 지점을 보던 중이어도 이동 범위를 캠퍼스 일대로 되돌린 뒤 옮긴다(범위가 좁으면 캠퍼스로 못 간다).
    farViewPartnerIdRef.current = null
    webViewRef.current?.injectJavaScript(viewBoundsScript(CAMPUS_VIEW_BOX))
    webViewRef.current?.injectJavaScript(
      // 진행 중인 '눌러 보기' 확대가 늦게 끝나며 돌아온 화면을 옛 핀 19배로 덮지 않게 먼저 멈춘다(옛 map.html 엔 없어 확인하고 부른다).
      `if (window.map && window.naver) { if (typeof window.cancelFocus === "function") window.cancelFocus(); map.setCenter(new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng})); map.setZoom(${DEFAULT_ZOOM}); } true;`,
    )
  }, [webViewRef, farViewPartnerIdRef])

  // 이미 지도 탭에 있을 때 하단 '지도' 탭을 다시 누르면 학사모 버튼처럼 캠퍼스로 돌아간다(10-08 요청).
  // tabPress 는 다른 탭에서 넘어올 때도 오지만 그땐 아직 이 화면이 포커스가 아니라 건너뛴다.
  useEffect(() => {
    // 지도는 하단 탭의 화면이라 탭 바가 보내는 tabPress 가 이 화면의 navigation 으로 바로 온다.
    const tabNavigation = navigation as unknown as { addListener: (type: 'tabPress', cb: () => void) => () => void }
    return tabNavigation.addListener('tabPress', () => {
      if (navigation.isFocused()) recenter()
    })
  }, [navigation, recenter])

  // 먼 지점 시트를 닫았거나(어떤 경로로든) 다른 것을 골랐으면 이동 범위를 캠퍼스로 되돌리고 캠퍼스로 돌아온다.
  useEffect(() => {
    const farId = farViewPartnerIdRef.current
    if (farId !== null && selectedPartner?.id !== farId) recenter()
  }, [selectedPartner, recenter, farViewPartnerIdRef])

  return { recenter }
}
