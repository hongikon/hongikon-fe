import { useCallback, useEffect, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSheetSizing } from '../useResizableSheet'
import { reportCategoryMeta } from '../../../constants/reportCategories'
import { useAuth } from '../../../contexts/AuthContext'
import { reportImageUrls } from '../../../utils/map/report/reports'
import { isUpcomingReport, parseReportDays, reportPhase } from '../../../utils/map/report/reportSchedule'
import { reportAuthorName } from '../../../utils/settings/nickname'
import { useSettings } from '../../../contexts/SettingsContext'
import { recordReportView } from '../../../apis/community'
import type { ReportListItem } from '../../../types'
import { useMapData } from '../../../lib/mapData'
import { usePhotoTileSizes } from './usePhotoTileSizes'
import { useReportOwnerActions } from './useReportOwnerActions'
import { useReportModeration } from './useReportModeration'
import type { ReportSheetPatch } from '../../../utils/map/report/reportSheet'
import type { ReportSheetProps } from '../../../components/map/report/ReportSheet'

/** ReportSheet 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportSheet({ report: reportProp, onClose, onChanged }: Pick<ReportSheetProps, 'report' | 'onClose' | 'onChanged'>) {
  // 장소 문구(가까운 건물)는 지도 데이터의 건물로 찾는다. 아직 없으면 좌표 대신 학교 이름이 나온다.
  const { buildings } = useMapData()
  // 화면 맨 아래에 붙는 시트라 홈 인디케이터 높이만큼 안쪽 아래 여백을 더 준다.
  const insets = useSafeAreaInsets()
  // 손잡이(회색 줄)로 작게 → 보통 → 화면 위 끝까지 크기 조절. 처음엔 작게(본문 일부) 연다.
  const { translateY, bodyHeight, panHandlers, chromeHandlers, onChromeLayout, onContentSizeChange, bodyGesture } = useSheetSizing(onClose, {
    smallRatio: 0.22,
  })
  const { accessToken } = useAuth()
  const { settings } = useSettings()
  // 공감·관심·조회 수·알림 설정은 시트에서 바로 바뀐다. 목록(지도)을 다시 받기 전까지 시트 사본에 덮어 둔다.
  const [patch, setPatch] = useState<ReportSheetPatch>({})
  useEffect(() => setPatch({}), [reportProp.id])
  const report: ReportListItem = { ...reportProp, ...patch }
  // 오늘 운영 상태('운영 중 · 18:00까지'·'곧 종료')는 시간이 흐르며 바뀌어 1분마다 다시 본다(11-08).
  const [clock, setClock] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const phase = reportPhase(report, clock)
  const daySpans = parseReportDays(report)
  // 날짜별 시간은 한 줄만(11-09 — 7줄이 맨 위를 차지했다): 오늘 운영하면 오늘, 아니면(예정·쉬는 날) 가장 가까운 날. 전체는 접어 둔다.
  const [daysOpen, setDaysOpen] = useState(false)
  const applyPatch = (next: ReportSheetPatch) =>
    setPatch((prev) => ({ ...prev, ...next }))
  // 제보 본문 창(본문 + 댓글 전체 + 입력줄). '본문 보기'·댓글 미리보기·"댓글 달기"가 모두 이 창을 연다.
  // 두 줄에 다 안 들어가면(줄바꿈·길이) '본문 보기'를 띄운다. 다른 제보로 바뀌면 닫는다.
  const [post, setPost] = useState<{ focusInput: boolean } | null>(null)
  const [commentsRefreshKey, setCommentsRefreshKey] = useState(0)
  const [contentClamped, setContentClamped] = useState(false)
  useEffect(() => {
    setPost(null)
    setContentClamped(false)
  }, [reportProp.id])
  const openPost = useCallback((focusInput: boolean) => setPost({ focusInput }), [])
  // 시트를 열 때 조회 1회(서버가 계정·설치 id 로 하루 한 번만 센다). 조회 수 기능 전 서버면 부르지 않는다.
  const tracksViews = typeof reportProp.viewCount === 'number'
  useEffect(() => {
    if (!tracksViews) return
    let alive = true
    void recordReportView(reportProp.id, accessToken).then((result) => {
      if (alive && result && typeof result.viewCount === 'number') {
        setPatch((prev) => ({ ...prev, viewCount: result.viewCount }))
      }
    })
    return () => {
      alive = false
    }
    // 토큰이 바뀌어도(재발급) 다시 세지 않는다 — 제보가 바뀔 때만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportProp.id, tracksViews])
  const canToggleNotify = report.isMine && typeof report.notifyEnabled === 'boolean' && !!accessToken
  // 공식 계정이 올린 제보는 작성자가 시간을 고칠 수 있다(서버도 공식 계정 작성자만 받는다).
  const canEditSchedule = report.isMine && !!report.authorOfficial && !!accessToken
  // 내 제보는 ⋯ 에서 고치고 지운다(11-09 요청). 로그인해 있어야 한다(게스트 화면엔 내 제보가 없다).
  const canManage = report.isMine && !!accessToken
  const hasOwnerMenu = canToggleNotify || canEditSchedule || canManage
  const owner = useReportOwnerActions({ report, accessToken, applyPatch, onChanged, onClose })
  const meta = reportCategoryMeta(report.category)
  const badgeLabel = report.customCategoryLabel || meta.label
  const upcoming = isUpcomingReport(report)
  const authorName = reportAuthorName(report)
  const moderation = useReportModeration({ report, authorName, onClose })
  const { flagging, flagged, menuOpen, error } = moderation
  // 작성자 숨기기는 서버가 authorKey 를 줄 때만(배포 전 서버면 메뉴를 숨긴다). 내 제보는 숨길 일이 없다.
  const canHideAuthor = !!report.authorKey && !report.isMine
  // 사진 URL 은 1시간 뒤 만료된다. 못 불러온 장은 깨진 칸 대신 숨긴다(다른 제보로 바뀌면 새 URL 이라 다시 시도).
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<readonly string[]>([])
  // 최대 3장(등록 순서). 여러 장 기능 전 서버는 imageUrl 1장만 준다.
  const photoUrls = reportImageUrls(report).filter((url) => !failedPhotoUrls.includes(url))
  // 크게 보는 사진 번호. null 이면 닫힘.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const markPhotoFailed = (url: string) =>
    setFailedPhotoUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))
  const photoSizes = usePhotoTileSizes(photoUrls)
  return {
    buildings,
    insets,
    translateY,
    bodyHeight,
    panHandlers,
    chromeHandlers,
    onChromeLayout,
    onContentSizeChange,
    bodyGesture,
    settings,
    report,
    clock,
    phase,
    daySpans,
    daysOpen,
    setDaysOpen,
    applyPatch,
    post,
    setPost,
    commentsRefreshKey,
    setCommentsRefreshKey,
    contentClamped,
    setContentClamped,
    openPost,
    canToggleNotify,
    canEditSchedule,
    canManage,
    hasOwnerMenu,
    owner,
    meta,
    badgeLabel,
    upcoming,
    authorName,
    moderation,
    flagging,
    flagged,
    menuOpen,
    error,
    canHideAuthor,
    photoUrls,
    viewerIndex,
    setViewerIndex,
    markPhotoFailed,
    photoSizes,
  }
}
