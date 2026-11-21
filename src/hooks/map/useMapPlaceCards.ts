import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { FOCUS_ZOOM } from '../../constants/map'

/** 관리 탭 "지도에서 보기"로 찍을 검토용 임시 핀. label 은 핀 이름표(제보 제목), detail 은 안내 줄의 작성자·건물·층. */
export interface PreviewTarget {
  lat: number
  lng: number
  label: string
  detail: string
}

/** 물어보기 "지도에서 보기"로 온 곳의 짧은 설명 카드. */
export interface AskCardContent {
  title: string
  summary: string
}

interface Options {
  webViewRef: RefObject<NaverMapViewHandle | null>
  postToMap: (msg: object) => void
  /** 건물·제휴·편의시설 시트가 열려 있는지. 설명 카드는 그 곳의 시트가 닫히면 거둔다. */
  placeSheetOpen: boolean
}

/**
 * 지도 위에 따로 얹는 두 가지: 관리 탭 "지도에서 보기"의 검토용 임시 핀(+안내 줄), 물어보기 "지도에서 보기"의 설명 카드(11-07).
 */
export function useMapPlaceCards({ webViewRef, postToMap, placeSheetOpen }: Options) {
  const navigation = useNavigation()

  /** 관리 탭 "지도에서 보기"로 찍은 검토용 임시 핀. 있으면 지도 위에 안내 줄(닫기)을 띄운다. */
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)
  const previewTargetRef = useRef(previewTarget)
  previewTargetRef.current = previewTarget
  /** 물어보기 "지도에서 보기"로 온 곳의 짧은 설명 카드(지도 위). 닫거나 그 곳 시트를 닫으면 사라진다(11-07). */
  const [askCard, setAskCard] = useState<AskCardContent | null>(null)

  const showPreviewPin = useCallback(
    (preview: PreviewTarget) => {
      // focusReport 는 예전 지도 페이지도 알아듣는다(가운데로만). previewPin 은 새 페이지에서 핀까지 찍는다.
      postToMap({ type: 'focusReport', lat: preview.lat, lng: preview.lng, zoom: FOCUS_ZOOM })
      postToMap({ type: 'previewPin', lat: preview.lat, lng: preview.lng, label: preview.label })
    },
    [postToMap],
  )

  /** 임시 핀을 안내 줄과 함께 찍는다. 지도가 아직 안 떴으면(지도 탭 첫 방문) 이 명령은 사라진다 — 준비되면 repin 이 다시 찍는다. */
  const showPreview = useCallback(
    (preview: PreviewTarget) => {
      setPreviewTarget(preview)
      showPreviewPin(preview)
    },
    [showPreviewPin],
  )

  /** 지도 페이지가 (다시) 준비됐을 때 — 관리 탭 "지도에서 보기" 핀은 지도가 뜨기 전에 보낸 명령이 사라지므로 다시 찍는다. */
  const repin = useCallback(() => {
    if (previewTargetRef.current) showPreviewPin(previewTargetRef.current)
  }, [showPreviewPin])

  /** 미리보기 핀과 안내 줄을 거둔다. 핀은 배포된 원격 map.html 에도 먹히게 페이지 전역을 직접 지운다. */
  const clearPreview = useCallback(() => {
    if (previewTargetRef.current === null) return
    setPreviewTarget(null)
    webViewRef.current?.injectJavaScript(
      'if (window.__previewPin) { window.__previewPin.setMap(null); window.__previewPin = null; } true;',
    )
  }, [webViewRef])

  // 지도 탭을 떠나면 미리보기 핀을 거둔다. 예전엔 지울 길이 없어 앱을 껐다 켜야 사라졌다.
  useFocusEffect(useCallback(() => () => clearPreview(), [clearPreview]))

  // 그 곳의 시트를 닫으면(지도를 누르거나 아래로 내림) 설명 카드도 거둔다.
  useEffect(() => {
    if (askCard && !placeSheetOpen) setAskCard(null)
  }, [askCard, placeSheetOpen])

  const closeAskCard = useCallback(() => setAskCard(null), [])
  /** 설명 카드의 '물어보기로 돌아가기'. */
  const backToAsk = useCallback(() => {
    setAskCard(null)
    navigation.navigate('Ask' as never)
  }, [navigation])

  return { previewTarget, showPreview, repin, clearPreview, askCard, setAskCard, closeAskCard, backToAsk }
}
