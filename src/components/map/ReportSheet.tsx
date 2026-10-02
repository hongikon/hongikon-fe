import { useState } from 'react'
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
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
import { formatFreshness, promptLogin } from '../../utils/reports'
import { reportAuthorName } from '../../utils/nickname'
import { confirmAction } from '../../utils/dialog'
import { hideAuthor } from '../../lib/hiddenAuthors'
import { REPORT_FLAG_REASONS } from '../../constants/report'
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
export default function ReportSheet({ report, onClose }: ReportSheetProps) {
  const { accessToken, logout } = useAuth()
  const meta = reportCategoryMeta(report.category)
  const badgeLabel = report.customCategoryLabel || meta.label
  const toast = useToast()
  const [flagging, setFlagging] = useState(false)
  const [flagged, setFlagged] = useState(false)
  // 신고 사유 고르는 중. 안드로이드 Alert 는 버튼이 3개까지라 시트 안에 사유 목록을 펼친다.
  const [choosingReason, setChoosingReason] = useState(false)
  const [lastReason, setLastReason] = useState<ReportFlagReason>('ETC')
  const authorName = reportAuthorName(report)
  // 작성자 숨기기는 서버가 authorKey 를 줄 때만(배포 전 서버면 메뉴를 숨긴다). 내 제보는 숨길 일이 없다.
  const canHideAuthor = !!report.authorKey && !report.isMine
  // 사진 URL 은 1시간 뒤 만료된다. 못 불러오면 깨진 칸 대신 숨긴다(다른 제보로 바뀌면 다시 시도).
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)

  const handleStartFlag = () => {
    // 제보 신고도 로그인이 필요하다(`POST /reports/{id}/flags` — 게스트는 401).
    if (!accessToken) {
      promptLogin('제보를 신고하려면 로그인해 주세요.', logout)
      return
    }
    setError(null)
    setChoosingReason(true)
  }

  const handleHideAuthor = () => {
    const key = report.authorKey
    if (!key) return
    confirmAction({
      title: '이 사용자의 제보 숨기기',
      message: `${authorName}님이 올린 제보가 이 기기에서 더 이상 보이지 않아요. 설정 > 일반 > 숨긴 사용자에서 다시 볼 수 있어요.`,
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

    setChoosingReason(false)
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
        <View style={[styles.badge, { backgroundColor: meta.color }]}>
          <Ionicons name={meta.icon} size={13} color={COLORS.white} />
          <Text style={styles.badgeText}>{badgeLabel}</Text>
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

      {!!report.imageUrl && report.imageUrl !== failedPhotoUrl && (
        <Image
          source={{ uri: report.imageUrl }}
          style={styles.photo}
          resizeMode="cover"
          onError={() => setFailedPhotoUrl(report.imageUrl ?? null)}
          accessibilityLabel="제보 첨부 사진"
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.author} numberOfLines={1}>{authorName}</Text>
        <View style={styles.actions}>
          {canHideAuthor && (
            <TouchableOpacity
              style={styles.flagBtn}
              onPress={handleHideAuthor}
              accessibilityRole="button"
              accessibilityLabel="이 사용자의 제보 숨기기"
            >
              <Ionicons name="eye-off-outline" size={14} color={COLORS.textTertiary} />
              <Text style={styles.flagText}>이 사용자 숨기기</Text>
            </TouchableOpacity>
          )}
          {flagged ? (
            <Text style={styles.flaggedText}>신고 접수됨</Text>
          ) : (
            <TouchableOpacity
              style={styles.flagBtn}
              onPress={choosingReason ? () => setChoosingReason(false) : handleStartFlag}
              disabled={flagging}
              accessibilityRole="button"
              accessibilityLabel={choosingReason ? '신고 취소' : '이 제보 신고하기'}
              accessibilityState={{ disabled: flagging, expanded: choosingReason }}
            >
              {flagging ? (
                <ActivityIndicator size="small" color={COLORS.textTertiary} />
              ) : (
                <>
                  <Ionicons name={choosingReason ? 'close' : 'flag-outline'} size={14} color={COLORS.textTertiary} />
                  <Text style={styles.flagText}>{choosingReason ? '취소' : '신고'}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {choosingReason && (
        <View style={styles.reasonBox} accessibilityRole="radiogroup" accessibilityLabel="신고 사유">
          <Text style={styles.reasonTitle}>신고 사유를 골라 주세요</Text>
          <View style={styles.reasonList}>
            {REPORT_FLAG_REASONS.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={styles.reasonChip}
                onPress={() => void handleFlag(item.value)}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}(으)로 신고하기`}
              >
                <Text style={styles.reasonChipText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.reasonHint}>운영진이 확인한 뒤 조치해요.</Text>
        </View>
      )}

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
  photo: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: COLORS.fill,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  author: { flexShrink: 1, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  flagBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 4 },
  flagText: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  flaggedText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.warningIcon },
  errorBox: { marginTop: 8 },
  reasonBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  reasonTitle: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  reasonList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  reasonChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  reasonChipText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textPrimary },
  reasonHint: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textTertiary, marginTop: 8 },
})
