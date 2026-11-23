import { useCallback, useEffect, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { getLiveReports } from '../../apis/reports'
import { useToast } from '../../components/common/Toast'
import { FOCUS_ZOOM } from '../../constants/map'
import { ROUTE_FINDING_ENABLED } from '../../constants/route'
import { consumeMapIntent, subscribeMapIntent } from '../../lib/mapIntents'
import type { Building, Facility, Partner, ReportListItem } from '../../types'
import { visibleReports } from '../../utils/map/report/reports'
import type { AskCardContent, PreviewTarget } from './useMapPlaceCards'

export type { AskCardContent, PreviewTarget } from './useMapPlaceCards'

interface Options {
  accessToken: string | null
  postToMap: (msg: object) => void
  buildings: readonly Building[]
  facilities: readonly Facility[]
  partners: readonly Partner[]
  /** 알림으로 연 제보를 숨긴 작성자 것이면 열지 않는다. */
  hiddenAuthorKeys: ReadonlySet<string>
  /** 위치 고르기를 끈다. 켜 둔 채 다른 시트를 열면 지도가 탭을 막는다. */
  stopPicker: () => void
  /** 정보 제보의 '지도에서 위치 찍기' — 정보 제보 창을 닫고 핀 고르기를 시작한다. */
  startPartnerLocationPick: () => void
  /** 제보 위치 고르기를 시작한다(게스트면 로그인 안내까지 부르는 쪽이 한다). */
  startReportPicker: () => void
  /** 제보 시트를 연다(null 이면 열린 시트만 닫는다). */
  openReport: (report: ReportListItem | null) => void
  /** 제보를 전체·전체 종류로 되돌린다(알림으로 연 제보가 HOT·특정 종류가 아닐 수 있다). */
  showAllReports: () => void
  /** 근처 제휴 여러 곳을 검색 창 맨 위 목록으로 연다. */
  showNearbyGroup: (group: Partner[]) => void
  /** 업체를 검색에서 고른 것처럼 연다(그 업체만 올리고 가운데로, 시트 열기). */
  selectPartner: (partner: Partner) => void
  /** 편의시설을 검색에서 고른 것처럼 연다(그 시설 시트). */
  openFacility: (facility: Facility) => void
  /** 지도에서 건물을 누를 때와 같은 정리로 건물 시트를 연다. 카메라는 호출한 쪽이 옮기지 않는다. */
  openBuilding: (building: Building) => void
  /** 물어보기 "지도에서 보기" 설명 카드를 띄운다(null 이면 거둔다). */
  setAskCard: (card: AskCardContent | null) => void
  /** 미리보기 핀과 안내 줄을 거둔다. */
  clearPreview: () => void
  /** 검토용 임시 핀을 안내 줄과 함께 찍는다(열린 시트는 부르는 쪽이 닫는다). */
  showPreview: (preview: PreviewTarget) => void
  /** 물어보기 길찾기 — 도착 건물(시설이면 층까지)을 정하고, 출발은 질문의 출발 건물, 없으면 내 위치로 잡는다. */
  startRouteTo: (target: { building: Building; floor: number | null; from: Building | null }) => void
}

/**
 * 다른 화면에서 넘어온 지도 요청(`lib/mapIntents.ts`). 지도 탭에 올 때(또는 이미 떠 있으면 즉시) 처리한다.
 * - 설정의 정보 제보 창 "지도에서 위치 찍기" → 핀 고르기
 * - 제보 알림 탭·내 제보 내역의 표시 중 제보 → 그 제보 포커스
 * - 내 제보 내역의 "지도로 가서 제보하기" → 제보 위치 고르기
 * - 근처 제휴 알림·물어보기 "지도에서 보기"/"여기서 가는 길"·관리 탭 "지도에서 보기"
 * 화면이 할 일은 콜백으로 받는다(콜백은 안정적일 필요 없다).
 */
export function useMapIntents({ accessToken, postToMap, buildings, facilities, partners, hiddenAuthorKeys, ...callbacks }: Options) {
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks
  const sourceRef = useRef({ accessToken, buildings, facilities, partners, hiddenAuthorKeys })
  sourceRef.current = { accessToken, buildings, facilities, partners, hiddenAuthorKeys }

  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  /** 알림발 제보 포커스 요청 순번. 연달아 탭했을 때 늦게 도착한 이전 요청 결과를 버린다. */
  const focusRequestRef = useRef(0)

  /**
   * 제보 알림(승인·새 제보)을 탭해 들어온 경우. 제보 레이어를 켜고, 진행 중 제보를 새로 받아 그 제보를 찾아
   * 시트를 띄우고 지도 가운데로 옮긴다. 레이어 목록은 승인 전에 받아 둔 것일 수 있어 따로 새로 받는다.
   * 이미 끝났거나 숨겨져 목록에 없으면 안내만 띄운다(지도는 그대로 쓸 수 있다).
   */
  const focusReportFromNotification = useCallback(
    async (reportId: number) => {
      const request = ++focusRequestRef.current
      const { stopPicker, openReport, showAllReports } = callbacksRef.current
      const { accessToken: token, hiddenAuthorKeys: hidden } = sourceRef.current
      // 위치를 고르던 중이면 그 모드부터 끈다 — 안 그러면 지도가 탭을 막은 채 제보 시트만 뜬다.
      stopPicker()
      openReport(null)
      // 제보는 갈래(제휴·학교 시설)와 따로라 보던 칩은 그대로 둔다(10-27).
      // 레이어가 이미 켜져 있으면 목록도 새로 받아 방금 올라온 제보가 마커로 보이게 한다. 꺼져 있으면 켜는 순간 받는다.
      // HOT 만 보던 중이면 전체 제보로 바꾼다(알림으로 연 제보가 HOT 이 아닐 수 있다). 종류도 같은 까닭으로 전부 켠다.
      showAllReports()
      try {
        const live = visibleReports(await getLiveReports({ accessToken: token, includeUpcoming: true }))
        if (request !== focusRequestRef.current) return
        const found = live.find((r) => r.id === reportId && !(r.authorKey && hidden.has(r.authorKey)))
        if (!found) {
          // 예정 제보는 3일 안에 시작할 때만 목록에 온다 — 그보다 먼 예정 제보도 여기로 온다.
          toastRef.current.show({ message: '이 제보는 지금 지도에 없어요. 아직 시작 전이거나 이미 끝났어요.', tone: 'info' })
          return
        }
        // 기다리는 사이 다른 배너를 열었을 수 있어 여기서 다시 닫고 연다.
        callbacksRef.current.openReport(found)
        postToMap({ type: 'focusReport', lat: found.lat, lng: found.lng })
      } catch {
        if (request !== focusRequestRef.current) return
        toastRef.current.show({ message: '제보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.', tone: 'info' })
      }
    },
    [postToMap],
  )

  const handleMapIntent = useCallback(() => {
    const intent = consumeMapIntent()
    const cb = callbacksRef.current
    const { buildings, facilities, partners } = sourceRef.current
    if (intent?.type === 'pickPartnerLocation') {
      cb.startPartnerLocationPick()
      return
    }
    if (intent?.type === 'focusReport') {
      void focusReportFromNotification(intent.reportId)
      return
    }
    if (intent?.type === 'startReport') {
      cb.startReportPicker()
      return
    }
    if (intent?.type === 'nearbyGroup') {
      // 근처에 제휴가 여러 곳 겹친 알림 → 그 곳들만 목록으로(알림을 만든 순서: 앞세운 곳, 그다음 가까운 순). 하나만 남으면 바로 시트.
      const group = intent.partnerIds.flatMap((id) => partners.filter((p) => p.id === id))
      if (group.length === 1) cb.selectPartner(group[0])
      else if (group.length > 1) cb.showNearbyGroup(group)
      return
    }
    if (intent?.type === 'focusPartner') {
      // 근처 제휴 알림 → 검색에서 고른 것과 같게(그 업체만 올리고 가운데로, 시트 열기). 지도 데이터에서 빠진 업체면 지도만 연다.
      const partner = partners.find((p) => p.id === intent.partnerId)
      if (partner) cb.selectPartner(partner)
      return
    }
    if (intent?.type === 'focusPlace') {
      // 물어보기 답의 "지도에서 보기"(11-07). 앱 지도 데이터에 있는 곳만 — 없으면 지도만 연다(카드도 없음).
      cb.stopPicker()
      cb.clearPreview()
      const split = intent.target.indexOf(':')
      const kind = intent.target.slice(0, split)
      const id = intent.target.slice(split + 1)
      let title: string | null = null
      if (kind === 'partner') {
        const partner = partners.find((p) => p.id === id)
        if (partner) {
          cb.selectPartner(partner)
          title = partner.name
        }
      } else if (kind === 'facility') {
        const facility = facilities.find((f) => f.id === id)
        if (facility) {
          cb.openFacility(facility)
          title = [facility.note, facility.buildingName].filter(Boolean).join(' · ')
        }
      } else if (kind === 'building') {
        const building = buildings.find((b) => b.code === id)
        if (building) {
          // 지도에서 건물을 누를 때와 같은 정리(다른 시트를 닫고 건물 배너), 그 건물로 옮겨 확대.
          cb.openBuilding(building)
          postToMap({ type: 'selectBuilding', name: building.name })
          postToMap({ type: 'focusReport', lat: building.lat, lng: building.lng, zoom: FOCUS_ZOOM })
          title = building.name
        }
      }
      cb.setAskCard(title ? { title: intent.title || title, summary: intent.summary ?? '' } : null)
      return
    }
    if (intent?.type === 'routeTo') {
      // 물어보기 답의 길찾기 버튼(11-09). 도착 = 그 건물(시설이면 그 건물·층). 출발 = 질문의 출발 건물(11-15 '제4공학관에서 홍문관'),
      // 없으면 내 위치(권한·위치를 못 쓰면 출발은 비워 둬 고르게 한다).
      cb.stopPicker()
      cb.clearPreview()
      cb.setAskCard(null)
      const split = intent.target.indexOf(':')
      const kind = intent.target.slice(0, split)
      const id = intent.target.slice(split + 1)
      const facility = kind === 'facility' ? facilities.find((f) => f.id === id) : undefined
      const building =
        kind === 'building'
          ? buildings.find((b) => b.code === id)
          : facility
            ? buildings.find((b) => b.name === facility.buildingName)
            : undefined
      if (!building || !ROUTE_FINDING_ENABLED) return
      const from = intent.from?.startsWith('building:')
        ? buildings.find((b) => b.code === intent.from!.slice('building:'.length))
        : undefined
      cb.startRouteTo({
        building,
        floor: typeof facility?.floor === 'number' ? facility.floor : null,
        from: from && from.code !== building.code ? from : null,
      })
      return
    }
    if (intent?.type === 'previewLocation') {
      cb.stopPicker()
      const preview = { lat: intent.lat, lng: intent.lng, label: intent.label ?? '제보 위치', detail: intent.detail ?? '' }
      cb.showPreview(preview)
    }
  }, [focusReportFromNotification, postToMap])

  useFocusEffect(handleMapIntent)
  useEffect(() => subscribeMapIntent(handleMapIntent), [handleMapIntent])
}
