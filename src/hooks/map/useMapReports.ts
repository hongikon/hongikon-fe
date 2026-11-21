import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QUERY_KEYS } from '../../constants/queryKeys'
import { useFocusEffect } from '@react-navigation/native'
import { getHotReports, hasCommunityFields } from '../../apis/community'
import { getLiveReports } from '../../apis/reports'
import { REPORT_CATEGORIES } from '../../constants/reportCategories'
import { useApiResource } from '../query/useApiResource'
import { useHiddenAuthorKeys, withoutHiddenAuthors } from '../../lib/hiddenAuthors'
import type { ReportCategory, ReportListItem } from '../../types'
import { toReportMarkers, visibleReports } from '../../utils/reports'
import { parseServerTime } from '../../utils/common/serverTime'

/** 제보 종류 칩 줄 — 제보 쓰기에서 고를 수 있는 종류 그대로(지금 목록에 없는 종류도 늘 보인다). */
export const REPORT_CATEGORY_KEYS = REPORT_CATEGORIES.map((meta) => meta.key)
const ALL_REPORT_CATEGORIES: ReadonlySet<ReportCategory> = new Set(REPORT_CATEGORY_KEYS)
/** 제보 레이어가 아직 한 번도 못 받았을 때 쓰는 빈 목록. 렌더마다 새 배열을 만들지 않게 모듈에 둔다. */
const EMPTY_REPORTS: ReportListItem[] = []
/** '불러오는 중' 줄은 이만큼 넘게 걸릴 때만 띄운다. */
const LOADING_NOTICE_DELAY_MS = 400
const REFRESH_MS = 60_000

interface Options {
  accessToken: string | null
  /** 지도 페이지에 메시지 보내기(마커 그리기). */
  postToMap: (msg: object) => void
  /** HOT 을 켜고 끌 때(열린 시트를 닫는 등 화면 쪽 정리). next 는 바뀐 뒤 값. */
  onToggleHot?: (next: boolean) => void
  /** 종류 칩으로 보이는 제보가 바뀔 때(열린 제보 시트를 닫는 등). */
  onCategoriesChange?: () => void
}

/**
 * 지도의 제보 레이어: 목록 받기(진행 중 + 3일 안 예정, 또는 HOT), 숨긴 사용자 빼기, 종류로 좁히기, 지도 마커 그리기,
 * 예정 제보가 시작하면·1분마다·지도 탭에 올 때 새로 받기. 지도 탭에선 늘 켜 둔다 — 제보가 앱의 주 기능이라(10-18).
 * 제보는 서버에서 받아오므로 켰을 때만 부른다. 지도·제휴·편의시설은 정적 데이터라 서버가 죽어도 그대로 동작해야 한다.
 */
export function useMapReports({ accessToken, postToMap, onToggleHot, onCategoriesChange }: Options) {
  const onToggleHotRef = useRef(onToggleHot)
  onToggleHotRef.current = onToggleHot
  const onCategoriesChangeRef = useRef(onCategoriesChange)
  onCategoriesChangeRef.current = onCategoriesChange

  // 끄는 스위치는 없고 메뉴에서 종류·HOT 만 고른다(10-27).
  const [reportsOn, setReportsOn] = useState(true)
  /**
   * 'HOT' 칩. 켜면 제보 레이어를 HOT·인기 제보(`GET /reports?sort=hot`, 최근 60분 순)로만 채우고 위에 짧은 목록을 띄운다.
   */
  const [hotOnly, setHotOnly] = useState(false)
  /** 지도에 보일 제보 종류(메뉴의 종류 칩, 여러 개 고름). 처음엔 전부. 받아 온 목록을 기기에서 좁힌다. */
  const [reportCategories, setReportCategories] = useState<ReadonlySet<ReportCategory>>(ALL_REPORT_CATEGORIES)
  const narrowed = reportCategories.size < ALL_REPORT_CATEGORIES.size
  /** 서버가 HOT 을 아는지(목록 항목에 fireCount 가 오는지). 모르면 HOT 칩을 숨긴다(커뮤니티 기능 배포 전). */
  const [hotAvailable, setHotAvailable] = useState(false)

  // 연결이 끊겨도 마지막으로 받은 제보는 계속 보여주고, 재연결되면 다시 받는다.
  const resource = useApiResource(
    async (signal) =>
      hotOnly
        ? visibleReports(await getHotReports({ accessToken, signal }))
        : // 3일(72시간) 안에 시작할 예정 제보도 받아 따로(속이 빈 배지) 보여 준다. 구버전 서버는 무시하고 진행 중만 준다.
          visibleReports(await getLiveReports({ accessToken, signal, includeUpcoming: true })),
    [accessToken, hotOnly],
    { enabled: reportsOn, fallbackMessage: '제보를 불러오지 못했어요.', queryKey: QUERY_KEYS.mapReports },
  )
  useEffect(() => {
    if (!hotOnly && hasCommunityFields(resource.data)) setHotAvailable(true)
  }, [resource.data, hotOnly])

  // 숨긴 사용자(기기 저장)의 제보는 지도에서 뺀다. 숨기는 순간 마커도 다시 그린다.
  const hiddenAuthorKeys = useHiddenAuthorKeys()
  const fetched = useMemo(
    () => (resource.data === undefined ? undefined : withoutHiddenAuthors(resource.data, hiddenAuthorKeys)),
    [resource.data, hiddenAuthorKeys],
  )

  /**
   * 지금 들고 있는 목록이 어느 HOT 상태로 받은 것인지. HOT 을 켜고 끄면 새 목록이 오기 전까지 앞 목록이 남아,
   * HOT 목록에 HOT 이 아닌 제보가 잠깐 끼거나 '제보가 없어요' 안내가 반짝였다. 상태가 맞을 때만 목록·안내를 그린다.
   */
  const hotOnlyRef = useRef(hotOnly)
  hotOnlyRef.current = hotOnly
  const [dataHotOnly, setDataHotOnly] = useState(hotOnly)
  useEffect(() => {
    setDataHotOnly(hotOnlyRef.current)
  }, [resource.data])
  const matchesHot = dataHotOnly === hotOnly

  /**
   * '제보를 불러오는 중…' 줄은 0.4초 넘게 걸릴 때만 띄운다. 금방 오는 경우엔 이 줄이 한 번 반짝이고
   * 바로 'HOT 제보가 없어요' 같은 결과 안내로 바뀌어, 문구가 두 번 뜨는 것처럼 보였다.
   */
  const [showLoading, setShowLoading] = useState(false)
  useEffect(() => {
    if (!resource.loading) {
      setShowLoading(false)
      return
    }
    const timer = setTimeout(() => setShowLoading(true), LOADING_NOTICE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [resource.loading])

  // HOT 을 켰는데 아직 전체 목록뿐이면, HOT 목록이 오기 전에도 HOT 인 제보만 남긴다(HOT 아닌 마커가 잠깐 남았다 사라지지 않게).
  const hotData = useMemo(
    () => (fetched !== undefined && hotOnly && !matchesHot ? fetched.filter((report) => report.hot === true) : fetched),
    [fetched, hotOnly, matchesHot],
  )
  /** 지도·목록에 보일 제보(종류로 좁힌 뒤). 아직 한 번도 못 받았으면 undefined. */
  const shown = useMemo(
    () => (hotData !== undefined && narrowed ? hotData.filter((report) => reportCategories.has(report.category)) : hotData),
    [hotData, narrowed, reportCategories],
  )
  const reports = shown ?? EMPTY_REPORTS
  /** 켰는데 지금 보일 제보가 하나도 없는 상태. */
  const empty = reportsOn && matchesHot && resource.data !== undefined && resource.errorMessage === null && reports.length === 0

  /**
   * 예정 제보가 시작하면 목록을 새로 받아 진행 중 마커로 바꿔 그린다(가장 이른 시작 시각에 한 번).
   * 새로 받은 목록에 또 예정 제보가 있으면 다음 시작 시각으로 다시 맞춰진다.
   */
  const nextUpcomingStart = useMemo(() => {
    const now = Date.now()
    let next = Infinity
    for (const report of shown ?? EMPTY_REPORTS) {
      const start = parseServerTime(report.startsAt)
      if (start > now && start < next) next = start
    }
    return Number.isFinite(next) ? next : null
  }, [shown])
  const refetch = resource.retry
  useEffect(() => {
    if (!reportsOn || nextUpcomingStart === null) return
    // 서버 시계와 조금 어긋나도 시작한 뒤에 받도록 몇 초 늦춘다. setTimeout 상한(약 24.8일)보다 훨씬 짧다(3일 안).
    const timer = setTimeout(() => refetch(), Math.max(0, nextUpcomingStart - Date.now()) + 5000)
    return () => clearTimeout(timer)
  }, [reportsOn, nextUpcomingStart, refetch])

  /**
   * 제보 핀 둘째 줄('오늘 14:00 시작'·'운영 중'·'곧 종료', 11-08)은 시간이 흐르며 바뀐다. 1분마다 다시 만들어 보고
   * 달라졌을 때만 다시 그린다(같으면 핀을 다시 그리지 않아 깜빡이지 않는다).
   */
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    if (!reportsOn) return
    const timer = setInterval(() => setClock(Date.now()), REFRESH_MS)
    return () => clearInterval(timer)
  }, [reportsOn])
  const lastMarkersRef = useRef<string | null>(null)
  /** 제보를 새로 받을 때마다(그리고 핀 글이 바뀔 때) 지도에 올린다. */
  useEffect(() => {
    if (!reportsOn || shown === undefined) {
      // 다시 켰을 때 같은 목록이어도 그리도록 잊는다.
      lastMarkersRef.current = null
      return
    }
    const markers = toReportMarkers(shown, clock)
    const key = JSON.stringify(markers)
    if (key === lastMarkersRef.current) return
    lastMarkersRef.current = key
    postToMap({ type: 'setReports', markers })
  }, [reportsOn, shown, clock, postToMap])

  /** 제보를 켜 두면 서버가 HOT 을 아는지 한 번 확인해 HOT 칩을 보일지 정한다(진행 중 제보 목록 한 번). */
  useEffect(() => {
    if (!reportsOn || hotAvailable) return
    const controller = new AbortController()
    getLiveReports({ accessToken, signal: controller.signal })
      .then((list) => {
        if (!controller.signal.aborted && hasCommunityFields(list)) setHotAvailable(true)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [reportsOn, hotAvailable, accessToken])

  /**
   * 제보 목록은 켜 둔 동안 지도 탭에 올 때마다, 그리고 1분마다 새로 받는다. 운영진이 승인한 제보를 반려·숨김하면
   * 서버 목록에서 빠지는데, 예전엔 앱을 백그라운드에 보냈다 와야만 다시 받아서 지도에 계속 남았다.
   */
  useFocusEffect(
    useCallback(() => {
      if (!reportsOn) return
      refetch()
      const timer = setInterval(refetch, REFRESH_MS)
      return () => clearInterval(timer)
    }, [reportsOn, refetch]),
  )

  /**
   * 'HOT' 칩. 켜면 HOT·인기 제보만 지도와 위 목록에 보이고, 다시 누르면 전체 제보 보기로 돌아간다.
   * 예전엔 다시 누르면 제보 레이어까지 꺼져 지도가 텅 비었다(10-06). 마커는 지우지 않고 새 목록이 오면 바꿔 그린다 —
   * 미리 지우면 같은 데이터가 다시 올 때 그리기 효과가 돌지 않아 지도가 빈 채로 남을 수 있다.
   */
  const toggleHot = useCallback(() => {
    const next = !hotOnlyRef.current
    setHotOnly(next)
    setReportsOn(true)
    onToggleHotRef.current?.(next)
  }, [])

  /**
   * 메뉴의 제보 종류 칩(여러 개 고름). 누를 때마다 그 종류만 넣고 뺀다. 제보는 지도에 늘 켜 두므로(10-27)
   * 마지막 하나는 뺄 수 없다 — 다 빼면 지도가 비어 고장처럼 보인다.
   */
  const toggleCategory = useCallback(
    (category: ReportCategory) => {
      if (reportCategories.size === 1 && reportCategories.has(category)) return
      onCategoriesChangeRef.current?.()
      const next = new Set(reportCategories)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      setReportCategories(next)
    },
    [reportCategories],
  )

  /** HOT·종류 좁히기를 풀고 전체 제보를 다시 받는다(알림으로 제보를 열 때 그 제보가 목록에 있게). */
  const showAll = useCallback(() => {
    setHotOnly(false)
    setReportCategories(ALL_REPORT_CATEGORIES)
    if (reportsOn) refetch()
    else setReportsOn(true)
  }, [reportsOn, refetch])

  /** 지도 메뉴의 제보 보기 필터(종류·HOT 토글). */
  const menuFilter = useMemo(
    () => ({
      categories: REPORT_CATEGORY_KEYS,
      selected: reportCategories,
      onToggleCategory: toggleCategory,
      hotOn: hotOnly,
      hotAvailable,
      onToggleHot: toggleHot,
    }),
    [reportCategories, toggleCategory, hotOnly, hotAvailable, toggleHot],
  )

  return {
    reportsOn,
    hotOnly,
    hotAvailable,
    reportCategories,
    resource,
    hiddenAuthorKeys,
    /** 지도·목록에 보일 제보. 아직 못 받았으면 undefined. */
    shown,
    /** shown 과 같되 못 받았으면 빈 배열. */
    reports,
    matchesHot,
    showLoading,
    empty,
    toggleHot,
    toggleCategory,
    showAll,
    refetch,
    menuFilter,
  }
}
