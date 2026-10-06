import { useEffect, useState } from 'react'
import { View, Text, Image, Pressable, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import IconButton from '../common/IconButton'
import { sheetCloseStyle } from './chipStyles'
import * as haptics from '../../lib/haptics'
import { useToast } from '../common/Toast'
import { reportCategoryMeta } from '../../constants/reportCategories'
import { useAuth } from '../../contexts/AuthContext'
import { flagReport } from '../../apis/reports'
import { ApiError, getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import RetryableError from '../common/RetryableError'
import { formatFreshness, promptLogin, reportImageUrls } from '../../utils/reports'
import { reportPlaceText } from '../../utils/shareReport'
import { isUpcomingReport } from '../../utils/reportSchedule'
import { openExternalUrl } from '../../utils/openExternalUrl'
import { reportAuthorName } from '../../utils/nickname'
import { confirmAction } from '../../utils/dialog'
import { hideAuthor } from '../../lib/hiddenAuthors'
import ReportCommentsSection from './comments/ReportCommentsSection'
import ModerationMenu from './ModerationMenu'
import ReportActionRow, { type ReportCommunityPatch } from './ReportActionRow'
import ReportOwnerMenu from './ReportOwnerMenu'
import HotBadge from '../common/HotBadge'
import OfficialBadge from '../common/OfficialBadge'
import { useSettings } from '../../contexts/SettingsContext'
import { communityErrorMessage, isCommunityApiMissing, recordReportView, setReportNotifications } from '../../apis/community'
import type { ReportFlagReason, ReportListItem } from '../../types'

interface ReportSheetProps {
  report: ReportListItem
  onClose: () => void
}

/**
 * 제보 상세 배너. 지도 마커를 누르면 뜬다.
 *
 * 본문(`content`)은 목록 응답에 없다(`docs/report-api-spec.md` §4.2 는 목록에서
 * content 를 뺀다). 제목·카테고리·시간·사진(서버가 준 presigned URL)까지만 보여주고, 본문이 필요해지면
 * 단건 조회 엔드포인트가 생긴 뒤에 붙인다.
 */
export default function ReportSheet({ report: reportProp, onClose }: ReportSheetProps) {
  const { accessToken, logout } = useAuth()
  const { settings } = useSettings()
  // 🔥·관심·조회 수·알림 설정은 시트에서 바로 바뀐다. 목록(지도)을 다시 받기 전까지 시트 사본에 덮어 둔다.
  const [patch, setPatch] = useState<ReportCommunityPatch & { notifyEnabled?: boolean | null }>({})
  useEffect(() => setPatch({}), [reportProp.id])
  const report: ReportListItem = { ...reportProp, ...patch }
  const applyPatch = (next: ReportCommunityPatch & { notifyEnabled?: boolean | null }) =>
    setPatch((prev) => ({ ...prev, ...next }))
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false)
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
  const handleToggleNotify = async () => {
    if (!accessToken || typeof report.notifyEnabled !== 'boolean') return
    const next = !report.notifyEnabled
    applyPatch({ notifyEnabled: next })
    try {
      const result = await setReportNotifications(report.id, next, accessToken)
      applyPatch({ notifyEnabled: result.enabled })
      haptics.success()
      toast.show({ message: result.enabled ? '이 제보 알림을 켰어요' : '이 제보 알림을 껐어요' })
    } catch (caught) {
      applyPatch({ notifyEnabled: !next })
      toast.show({
        message: isCommunityApiMissing(caught, true)
          ? '아직 이 기능을 쓸 수 없어요'
          : communityErrorMessage(caught, '알림 설정을 바꾸지 못했어요.'),
        tone: 'warning',
      })
    }
  }
  const meta = reportCategoryMeta(report.category)
  const badgeLabel = report.customCategoryLabel || meta.label
  const upcoming = isUpcomingReport(report)
  const toast = useToast()
  const [flagging, setFlagging] = useState(false)
  const [flagged, setFlagged] = useState(false)
  // ⋮ 메뉴(이 사용자 숨기기 · 신고하기 → 사유). 남의 제보에만 있다.
  const [menuOpen, setMenuOpen] = useState(false)
  const [lastReason, setLastReason] = useState<ReportFlagReason>('ETC')
  const authorName = reportAuthorName(report)
  // 작성자 숨기기는 서버가 authorKey 를 줄 때만(배포 전 서버면 메뉴를 숨긴다). 내 제보는 숨길 일이 없다.
  const canHideAuthor = !!report.authorKey && !report.isMine
  // 사진 URL 은 1시간 뒤 만료된다. 못 불러온 장은 깨진 칸 대신 숨긴다(다른 제보로 바뀌면 새 URL 이라 다시 시도).
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<readonly string[]>([])
  // 최대 3장(등록 순서). 여러 장 기능 전 서버는 imageUrl 1장만 준다.
  const photoUrls = reportImageUrls(report).filter((url) => !failedPhotoUrls.includes(url))
  const markPhotoFailed = (url: string) =>
    setFailedPhotoUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))
  const [error, setError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)

  /** ⋮ 메뉴의 "신고하기". 제보 신고는 로그인이 필요하다(`POST /reports/{id}/flags` — 게스트는 401). */
  const beforeFlag = () => {
    if (!accessToken) {
      promptLogin('제보를 신고하려면 로그인해 주세요.', logout)
      return false
    }
    setError(null)
    return true
  }

  const handleHideAuthor = () => {
    const key = report.authorKey
    if (!key) return
    confirmAction({
      title: '이 사용자의 제보 숨기기',
      message: `${authorName}님이 올린 제보와 댓글이 이 기기에서 더 이상 보이지 않아요. 설정 > 일반 > 숨긴 사용자에서 다시 볼 수 있어요.`,
      confirmLabel: '숨기기',
      destructive: true,
      onConfirm: () => {
        hideAuthor(key, authorName)
        haptics.success()
        toast.show({ message: '이 사용자의 제보를 숨겼어요' })
        onClose()
      },
    })
  }

  const handleFlag = async (reason: ReportFlagReason = lastReason) => {
    if (!accessToken) {
      promptLogin('제보를 신고하려면 로그인해 주세요.', logout)
      return
    }

    setLastReason(reason)
    setFlagging(true)
    setError(null)
    try {
      try {
        await flagReport(report.id, { reason }, accessToken)
      } catch (caught) {
        // PRIVACY 는 서버에 나중에 들어온 사유다. 구버전 서버가 모르는 사유로 400 을 주면 '기타'로 다시 보낸다.
        if (reason === 'PRIVACY' && caught instanceof ApiError && caught.status === 400) {
          await flagReport(report.id, { reason: 'ETC' }, accessToken)
        } else {
          throw caught
        }
      }
      setFlagged(true)
      haptics.success()
      toast.show({ message: '신고가 접수됐어요. 확인 후 조치할게요' })
    } catch (caught) {
      // 이미 신고한 제보면 서버가 409 를 준다 — 실패가 아니라 "신고함" 상태로 보여준다.
      if (caught instanceof ApiError && caught.status === 409) {
        setFlagged(true)
        toast.show({ message: '이미 신고한 제보예요', tone: 'info' })
        return
      }
      // 신고는 POST 라 자동으로 다시 보내지 않는다(중복 신고 방지). 연결 문제일 때만
      // "다시 시도" 버튼을 줘서 사용자가 직접 다시 보내게 한다.
      setError({
        message: getErrorMessage(caught, '신고를 접수하지 못했어요.'),
        network: isNetworkError(caught),
        retryable: isRetryableError(caught),
      })
    } finally {
      setFlagging(false)
    }
  }

  return (
    <View style={styles.sheet}>
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

      <Text style={styles.title}>{report.title}</Text>
      <Text style={styles.freshness}>{formatFreshness(report)}</Text>
      {/* 장소: 작성자가 고친 장소 설명, 없으면 핀 근처 건물·층. */}
      <View style={styles.placeRow}>
        <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} />
        <Text style={styles.placeText} numberOfLines={2}>
          {reportPlaceText(report)}
        </Text>
      </View>

      {photoUrls.length > 0 && (
        // 1장이면 넓게, 2~3장이면 같은 폭으로 나란히. 누르면 원본(presigned URL)을 브라우저로 연다.
        <View style={styles.photoRow}>
          {photoUrls.map((url, index) => (
            <Pressable
              key={url}
              style={[styles.photoTile, photoUrls.length > 1 && styles.photoTileSmall]}
              onPress={() => openExternalUrl(url)}
              accessibilityRole="imagebutton"
              accessibilityLabel={
                photoUrls.length > 1
                  ? `제보 첨부 사진 ${index + 1}/${photoUrls.length}, 원본 보기`
                  : '제보 첨부 사진, 원본 보기'
              }
            >
              <Image
                source={{ uri: url }}
                style={styles.photo}
                resizeMode="cover"
                onError={() => markPhotoFailed(url)}
              />
            </Pressable>
          ))}
        </View>
      )}

      <ReportActionRow report={report} onPatch={applyPatch} />

      <View style={styles.footer}>
        <View style={styles.authorRow}>
          <Text style={styles.author} numberOfLines={1}>{authorName}</Text>
          {report.authorOfficial ? <OfficialBadge /> : null}
        </View>
        <View style={styles.actions}>
          {flagging ? (
            <ActivityIndicator size="small" color={COLORS.textTertiary} />
          ) : flagged ? (
            <Text style={styles.flaggedText}>신고 접수됨</Text>
          ) : null}
          {/* 내 제보는 ⋯ 에 "이 제보 알림 끄기/켜기"(서버가 notifyEnabled 를 줄 때만). */}
          {canToggleNotify && (
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => setOwnerMenuOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`내 제보 메뉴(이 제보 알림 ${report.notifyEnabled ? '끄기' : '켜기'})`}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
          {/* 내 제보에는 숨기기·신고가 필요 없다. 남의 제보는 ⋮ 메뉴 하나로 모은다. */}
          {!report.isMine && (
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => setMenuOpen(true)}
              disabled={flagging}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="제보 메뉴(이 사용자 숨기기, 신고하기)"
            >
              <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {canToggleNotify && (
        <ReportOwnerMenu
          visible={ownerMenuOpen}
          onClose={() => setOwnerMenuOpen(false)}
          notifyEnabled={!!report.notifyEnabled}
          globalOff={!settings.reportStatusAlert}
          onToggleNotify={() => void handleToggleNotify()}
        />
      )}

      <ModerationMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        target="제보"
        canHide={canHideAuthor}
        onHide={handleHideAuthor}
        flagged={flagged}
        beforeFlag={beforeFlag}
        onFlag={(reason) => void handleFlag(reason)}
      />

      {error !== null && (
        <RetryableError
          variant="chip"
          style={styles.errorBox}
          message={error.message}
          isNetworkError={error.network}
          onRetry={error.retryable ? () => void handleFlag() : undefined}
          retrying={flagging}
        />
      )}

      <ReportCommentsSection key={report.id} report={report} />
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
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
    borderRadius: 12,
  },
  badgeText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.white },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginTop: 10,
  },
  freshness: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4 },
  placeText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 17, color: COLORS.textSecondary },
  photoRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  photoTile: { flex: 1, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.fill },
  photoTileSmall: { height: 110 },
  photo: { width: '100%', height: '100%' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  author: { flexShrink: 1, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  moreBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  flaggedText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.warningIcon },
  errorBox: { marginTop: 8 },
})
