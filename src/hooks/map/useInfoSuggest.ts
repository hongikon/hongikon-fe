import { useCallback, useRef, useState, type RefObject } from 'react'
import type { InfoSuggestLocation, InfoSuggestPrefill } from '../../components/settings/InfoSuggestModal'
import type { Partner } from '../../types'
import { partnerEditSuggestion } from '../../utils/map/partnerEdit'

/** 정보 제보 창의 열린 상태. 위치 없이 열 수도 있어(location null) 닫힘(null)과 구분하려고 객체로 둔다. */
interface InfoSuggestState {
  location: InfoSuggestLocation | null
  prefill?: InfoSuggestPrefill
}

interface Options {
  /** 지금 고른 제휴(제휴 시트의 '정보 수정'이 이 가게로 연다). */
  selectedPartnerRef: RefObject<Partner | null>
  /** 제휴 시트를 닫는다(지도 강조도 거둔다). */
  closePartnerSheet: () => void
  /** 지도 가운데 핀으로 정보 제보 위치 고르기를 시작한다. before: 취소하면 돌아갈 전 위치. */
  startPartnerLocationPick: (before: InfoSuggestLocation | null) => void
}

/**
 * 정보 제보 창(제휴·전시·행사 위치). 지도에서 위치를 고르러 갔다 오는 흐름과, 제휴 시트의 '정보 수정'을 맡는다.
 */
export function useInfoSuggest(options: Options) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [state, setState] = useState<InfoSuggestState | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  /** 위치와 함께(또는 위치 없이 null) 연다. 지도에서 고른 자리·고르다 취소한 전 위치로 돌아올 때 쓴다. */
  const open = useCallback((location: InfoSuggestLocation | null) => setState({ location }), [])
  const close = useCallback(() => setState(null), [])

  /** 정보 제보 창의 '지도에서 위치 고르기': 창을 닫고 핀 고르기로. 취소하면 전 위치로 돌아가게 기억해 둔다. */
  const pickOnMap = useCallback(() => {
    setState(null)
    optionsRef.current.startPartnerLocationPick(stateRef.current?.location ?? null)
  }, [])

  /** 제휴 시트의 '정보 수정': 그 가게로 정보 제보 창을 '정보 수정'으로 연다(이름·주소·소속·위치를 채워서). 시트는 닫는다. */
  const suggestPartnerEdit = useCallback(() => {
    const partner = optionsRef.current.selectedPartnerRef.current
    if (!partner) return
    optionsRef.current.closePartnerSheet()
    setState(partnerEditSuggestion(partner))
  }, [])

  return { state, visible: state !== null, open, close, pickOnMap, suggestPartnerEdit }
}
