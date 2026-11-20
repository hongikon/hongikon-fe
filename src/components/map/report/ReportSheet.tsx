import { useCallback, useEffect, useState, memo } from 'react'
import SheetHandle from '../SheetHandle'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import { useSheetSizing } from '../../../hooks/useResizableSheet'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import IconButton from '../../common/IconButton'
import { sheetCloseStyle } from '../chipStyles'
import { reportCategoryMeta } from '../../../constants/reportCategories'
import { useAuth } from '../../../contexts/AuthContext'
import RetryableError from '../../common/RetryableError'
import { formatFreshness, reportImageUrls } from '../../../utils/reports'
import ImageViewerModal from '../../common/ImageViewerModal'
import { reportPlaceText } from '../../../utils/shareReport'
import { isUpcomingReport, parseReportDays, reportPhase } from '../../../utils/reportSchedule'
import { reportAuthorName } from '../../../utils/nickname'
import ReportCommentsSection from './comments/ReportCommentsSection'
import ReportCommentsModal from './comments/ReportCommentsModal'
import ModerationMenu from './ModerationMenu'
import ReportActionRow from './ReportActionRow'
import ReportOwnerMenu from './ReportOwnerMenu'
import ReportScheduleEditModal from './ReportScheduleEditModal'
import ReportEditModal from './ReportEditModal'
import HotBadge from '../../common/HotBadge'
import { useSettings } from '../../../contexts/SettingsContext'
import { recordReportView } from '../../../apis/community'
import type { ReportListItem } from '../../../types'
import { useMapData } from '../../../lib/mapData'
import { RADIUS } from '../../../constants/spacing'
import SheetScrollBody from '../SheetScrollBody'
import { usePhotoTileSizes } from '../../../hooks/map/report/usePhotoTileSizes'
import { useReportOwnerActions } from '../../../hooks/map/report/useReportOwnerActions'
import { useReportModeration } from '../../../hooks/map/report/useReportModeration'
import type { ReportSheetPatch } from '../../../utils/map/reportSheet'
import ReportContentPreview from './sheet/ReportContentPreview'
import ReportDaysBox from './sheet/ReportDaysBox'
import ReportPhotoRow from './sheet/ReportPhotoRow'
import ReportSheetFooter from './sheet/ReportSheetFooter'

interface ReportSheetProps {
  report: ReportListItem
  onClose: () => void
  /** 내 제보를 고치거나 지운 뒤 — 지도 목록을 다시 받는다. */
  onChanged?: () => void
}

/**
 * 제보 상세 배너. 지도 마커를 누르면 뜬다.
 *
 * 본문(`content`)은 목록 응답에 실려 온다(2026-10-06 서버부터). 지도를 덜 가리게 시트에는 두 줄만 보여 주고,
 * 길면 '본문 보기'로 제보 본문 창(ReportCommentsModal — 본문 + 댓글 + 입력줄, 아래 탭 막대까지 덮음)을 연다.
 *
 * 내 제보 메뉴(⋯)는 `useReportOwnerActions`, 남의 제보 숨기기·신고(⋮)는 `useReportModeration` 이 맡는다.
 */
function ReportSheet({ report: reportProp, onClose, onChanged }: ReportSheetProps) {
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

  return (
    <Animated.View style={[styles.sheet, { paddingBottom: 16 + insets.bottom, transform: [{ translateY }] }]}>
      {/* 손잡이 + 머리줄(종류·제목·시간)은 늘 보이고, 그 아래 본문만 크기 조절된다(useSheetSizing). */}
      <View onLayout={onChromeLayout} {...chromeHandlers}>
      <View style={{ marginTop: -6 }}>
        <SheetHandle panHandlers={panHandlers} gap={12} />
      </View>
      <View style={styles.header}>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon} size={13} color={COLORS.white} />
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
          {report.hot ? <HotBadge /> : null}
          {upcoming && (
            // 아직 시작 전인 예정 제보. 지도 마커도 속이 빈 배지로 따로 보인다.
            <View style={[styles.badge, styles.upcomingBadge]} accessibilityLabel="예정 제보, 아직 시작 전">
              <Ionicons name="time-outline" size={13} color={COLORS.primary} />
              <Text style={[styles.badgeText, styles.upcomingBadgeText]}>예정</Text>
            </View>
          )}
        </View>
        <IconButton
          icon="close"
          size={20}
          color={COLORS.textTertiary}
          onPress={onClose}
          accessibilityLabel="닫기"
          style={sheetCloseStyle}
        />
      </View>

      {/* 제목을 누르면 본문 창으로(10-31 — 제목만 눌러선 아무 일도 없었다). */}
      <Pressable
        onPress={() => openPost(false)}
        style={({ pressed }) => pressed && { opacity: 0.6 }}
        accessibilityRole="button"
        accessibilityLabel={`${report.title}, 제보 본문 보기`}
      >
        <Text style={styles.title}>{report.title}</Text>
      </Pressable>
      <Text style={styles.freshness}>{formatFreshness(report)}</Text>
      {phase.text && phase.kind !== 'upcoming' ? (
        <View style={[styles.phase, phase.kind === 'ending' && styles.phaseEnding, phase.kind === 'later' && styles.phaseLater]}>
          <Text style={[styles.phaseText, phase.kind === 'ending' && styles.phaseTextEnding]}>{phase.text}</Text>
        </View>
      ) : null}
      </View>

      <SheetScrollBody sheetGesture={bodyGesture} onContentSizeChange={onContentSizeChange} sheetGestureDisabled={menuOpen || owner.ownerMenuOpen || owner.scheduleOpen || viewerIndex !== null} style={{ height: bodyHeight }} bounces={false}>
      {/* 장소: 작성자가 고친 장소 설명, 없으면 핀 근처 건물·층. */}
      <View style={styles.placeRow}>
        <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} />
        <Text style={styles.placeText} numberOfLines={2}>
          {reportPlaceText(report, buildings)}
        </Text>
      </View>

      {!!report.content?.trim() && (
        <ReportContentPreview
          content={report.content}
          clamped={contentClamped}
          onClamped={() => setContentClamped(true)}
          onOpenPost={() => openPost(false)}
        />
      )}

      {daySpans ? (
        <ReportDaysBox
          daySpans={daySpans}
          clock={clock}
          open={daysOpen}
          onToggle={() => setDaysOpen((open) => !open)}
        />
      ) : null}

      {photoUrls.length > 0 && (
        <ReportPhotoRow
          photoUrls={photoUrls}
          photoSizes={photoSizes}
          onOpen={setViewerIndex}
          onError={markPhotoFailed}
        />
      )}
      <ImageViewerModal urls={photoUrls} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />

      <ReportActionRow report={report} onPatch={applyPatch} />

      <ReportSheetFooter
        authorName={authorName}
        authorOfficial={!!report.authorOfficial}
        edited={!!report.editedAt}
        isMine={!!report.isMine}
        flagging={flagging}
        flagged={flagged}
        hasOwnerMenu={hasOwnerMenu}
        ownerMenuLabel={
          `내 제보 메뉴(${canManage ? '수정, 삭제' : '시간 수정'}${canToggleNotify ? `, 이 제보 알림 ${report.notifyEnabled ? '끄기' : '켜기'}` : ''})`
        }
        onOpenOwnerMenu={() => owner.setOwnerMenuOpen(true)}
        onOpenModerationMenu={() => moderation.setMenuOpen(true)}
      />

      {hasOwnerMenu && (
        <ReportOwnerMenu
          visible={owner.ownerMenuOpen}
          onClose={() => owner.setOwnerMenuOpen(false)}
          notifyEnabled={!!report.notifyEnabled}
          globalOff={!settings.reportStatusAlert}
          onToggleNotify={canToggleNotify ? () => void owner.handleToggleNotify() : undefined}
          onEditSchedule={canEditSchedule ? () => owner.setScheduleOpen(true) : undefined}
          onEdit={canManage ? () => owner.setEditOpen(true) : undefined}
          onDelete={canManage ? () => void owner.handleDelete() : undefined}
          deleting={owner.deleting}
        />
      )}
      {canManage && (
        <ReportEditModal
          report={owner.editOpen ? report : null}
          onClose={() => owner.setEditOpen(false)}
          onSaved={owner.handleEdited}
        />
      )}
      {canEditSchedule && (
        <ReportScheduleEditModal
          visible={owner.scheduleOpen}
          startsAt={report.startsAt}
          endsAt={report.endsAt}
          days={report.days}
          saving={owner.scheduleSaving}
          onClose={() => owner.setScheduleOpen(false)}
          onSave={(next) => void owner.handleSaveSchedule(next)}
        />
      )}

      <ModerationMenu
        visible={menuOpen}
        onClose={() => moderation.setMenuOpen(false)}
        target="제보"
        canHide={canHideAuthor}
        onHide={moderation.handleHideAuthor}
        flagged={flagged}
        beforeFlag={moderation.beforeFlag}
        onFlag={(reason) => void moderation.handleFlag(reason)}
      />

      {error !== null && (
        <RetryableError
          variant="chip"
          style={styles.errorBox}
          message={error.message}
          isNetworkError={error.network}
          onRetry={error.retryable ? () => void moderation.handleFlag() : undefined}
          retrying={flagging}
        />
      )}

      <ReportCommentsSection key={report.id} report={report} onOpen={openPost} refreshKey={commentsRefreshKey} />
      </SheetScrollBody>

      <ReportCommentsModal
        visible={post !== null}
        focusInput={post?.focusInput ?? false}
        report={report}
        placeText={reportPlaceText(report, buildings)}
        onPatch={applyPatch}
        onClose={() => {
          setPost(null)
          // 창에서 쓰거나 지운 것을 시트 미리보기에 반영한다.
          setCommentsRefreshKey((key) => key + 1)
        }}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // 건물·제휴 시트처럼 화면 아래에 붙는다(지도 아래 NAVER 로고 줄까지 덮어 열고 닫을 때 어수선하지 않게).
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: 20,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  upcomingBadge: { backgroundColor: COLORS.primarySoft },
  upcomingBadgeText: { color: COLORS.primary },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: RADIUS.pill,
  },
  badgeText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.white },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginTop: 10,
  },
  freshness: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  // 오늘 운영 상태(11-08). 운영 중은 옅은 남색, 곧 종료는 남색으로 채움, 운영 시간 밖은 테두리만.
  phase: { alignSelf: 'flex-start', marginTop: 6, marginBottom: 8, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: COLORS.primarySoft },
  phaseEnding: { backgroundColor: COLORS.primary },
  phaseLater: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.chipBorder },
  phaseText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.primary },
  phaseTextEnding: { color: COLORS.white },
  placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4 },
  placeText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 17, color: COLORS.textSecondary },
  errorBox: { marginTop: 8 },
})


export default memo(ReportSheet)
