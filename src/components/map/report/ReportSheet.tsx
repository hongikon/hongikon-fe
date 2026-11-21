import { memo } from 'react'
import SheetHandle from '../SheetHandle'
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import IconButton from '../../common/IconButton'
import { sheetCloseStyle } from '../chipStyles'
import RetryableError from '../../common/RetryableError'
import { formatFreshness } from '../../../utils/map/report/reports'
import ImageViewerModal from '../../common/ImageViewerModal'
import { reportPlaceText } from '../../../utils/map/report/shareReport'
import ReportCommentsSection from './comments/ReportCommentsSection'
import ReportCommentsModal from './comments/ReportCommentsModal'
import ModerationMenu from './ModerationMenu'
import ReportActionRow from './ReportActionRow'
import ReportOwnerMenu from './ReportOwnerMenu'
import ReportScheduleEditModal from './ReportScheduleEditModal'
import ReportEditModal from './ReportEditModal'
import HotBadge from '../../common/HotBadge'
import type { ReportListItem } from '../../../types'
import { RADIUS } from '../../../constants/spacing'
import SheetScrollBody from '../SheetScrollBody'
import RouteEndpointButtons from '../route/RouteEndpointButtons'
import { type RouteNext } from '../../../utils/map/route/routeEndpointButtons'
import ReportContentPreview from './sheet/ReportContentPreview'
import ReportDaysBox from './sheet/ReportDaysBox'
import ReportPhotoRow from './sheet/ReportPhotoRow'
import ReportSheetFooter from './sheet/ReportSheetFooter'
import { useReportSheet } from '../../../hooks/map/report/useReportSheet'

export interface ReportSheetProps {
  report: ReportListItem
  onClose: () => void
  /** 내 제보를 고치거나 지운 뒤 — 지도 목록을 다시 받는다. */
  onChanged?: () => void
  /**
   * 이 제보로 가는 길찾기에 쓸 건물 이름(제보가 있는 캠퍼스 건물). 출발·도착 버튼과 함께 넘기면
   * 제목 아래에 버튼 줄을 그린다. 길찾기가 꺼져 있거나 캠퍼스 밖·건물 밖 제보면 넘기지 않는다.
   */
  routeBuildingName?: string | null
  onSetFrom?: () => void
  onSetTo?: () => void
  routeNext?: RouteNext
}

/**
 * 제보 상세 배너. 지도 마커를 누르면 뜬다.
 *
 * 본문(`content`)은 목록 응답에 실려 온다(2026-10-06 서버부터). 지도를 덜 가리게 시트에는 두 줄만 보여 주고,
 * 길면 '본문 보기'로 제보 본문 창(ReportCommentsModal — 본문 + 댓글 + 입력줄, 아래 탭 막대까지 덮음)을 연다.
 *
 * 내 제보 메뉴(⋯)는 `useReportOwnerActions`, 남의 제보 숨기기·신고(⋮)는 `useReportModeration` 이 맡는다.
 */
function ReportSheet({ report: reportProp, onClose, onChanged, routeBuildingName = null, onSetFrom, onSetTo, routeNext = null }: ReportSheetProps) {
  const { buildings, insets, translateY, bodyHeight, panHandlers, chromeHandlers, onChromeLayout, onContentSizeChange, bodyGesture, settings, report, clock, phase, daySpans, daysOpen, setDaysOpen, applyPatch, post, setPost, commentsRefreshKey, setCommentsRefreshKey, contentClamped, setContentClamped, openPost, canToggleNotify, canEditSchedule, canManage, hasOwnerMenu, owner, meta, badgeLabel, upcoming, authorName, moderation, flagging, flagged, menuOpen, error, canHideAuthor, photoUrls, viewerIndex, setViewerIndex, markPhotoFailed, photoSizes } = useReportSheet({ report: reportProp, onClose, onChanged })

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
      {/* 이 제보로 가는 길찾기. 캠퍼스 건물 안 제보만(캠퍼스 밖·건물 밖 제보는 부르는 쪽이 넘기지 않는다, 11-20). */}
      {routeBuildingName && onSetFrom && onSetTo ? (
        <View style={styles.route}>
          <RouteEndpointButtons name={routeBuildingName} routeNext={routeNext} onSetFrom={onSetFrom} onSetTo={onSetTo} />
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
  route: { marginTop: 10 },
})


export default memo(ReportSheet)
