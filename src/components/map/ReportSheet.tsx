import { useState } from 'react'
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { reportCategoryMeta } from '../../constants/reportCategories'
import { useAuth } from '../../contexts/AuthContext'
import { flagReport } from '../../lib/reportsApi'
import { formatFreshness } from '../../utils/reports'
import type { ReportListItem } from '../../types'

interface ReportSheetProps {
  report: ReportListItem
  onClose: () => void
}

/**
 * 제보 상세 배너. 지도 마커를 누르면 뜬다.
 *
 * 본문(`content`)은 목록 응답에 없다(`docs/report-api-spec.md` §4.2 는 목록에서
 * content 를 뺀다). 제목·카테고리·시간·사진까지만 보여주고, 본문이 필요해지면
 * 단건 조회 엔드포인트가 생긴 뒤에 붙인다.
 */
export default function ReportSheet({ report, onClose }: ReportSheetProps) {
  const { accessToken } = useAuth()
  const meta = reportCategoryMeta(report.category)
  const [flagging, setFlagging] = useState(false)
  const [flagged, setFlagged] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFlag = async () => {
    if (!accessToken) {
      setError('신고하려면 먼저 로그인해주세요.')
      return
    }

    setFlagging(true)
    setError(null)
    try {
      // 사유 선택 화면은 아직 없다. 스펙 §4.4 의 사유 목록이 확정되면
      // 고르게 하고, 그 전까지는 가장 넓은 값으로 보낸다.
      await flagReport(report.id, { reason: 'ETC' }, accessToken)
      setFlagged(true)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : '신고를 접수하지 못했습니다.',
      )
    } finally {
      setFlagging(false)
    }
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: meta.color }]}>
          <Ionicons name={meta.icon} size={13} color={COLORS.white} />
          <Text style={styles.badgeText}>{meta.label}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Ionicons name="close" size={18} color="#999" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{report.title}</Text>
      <Text style={styles.freshness}>{formatFreshness(report)}</Text>

      {report.imageUrl !== undefined && (
        <Image
          source={{ uri: report.imageUrl }}
          style={styles.photo}
          accessibilityLabel="제보 첨부 사진"
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.author}>{report.authorNickname}</Text>
        {flagged ? (
          <Text style={styles.flaggedText}>신고 접수됨</Text>
        ) : (
          <TouchableOpacity
            style={styles.flagBtn}
            onPress={handleFlag}
            disabled={flagging}
            accessibilityRole="button"
            accessibilityLabel="이 제보 신고하기"
            accessibilityState={{ disabled: flagging }}
          >
            {flagging ? (
              <ActivityIndicator size="small" color="#999" />
            ) : (
              <>
                <Ionicons name="flag-outline" size={13} color="#999" />
                <Text style={styles.flagText}>신고</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {error !== null && <Text style={styles.errorText}>{error}</Text>}
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
    borderRadius: 14,
    padding: 14,
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
  badgeText: { fontFamily: FONTS.semibold, fontSize: 11.5, color: COLORS.white },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: 15.5,
    color: COLORS.textPrimary,
    marginTop: 10,
  },
  freshness: { fontFamily: FONTS.regular, fontSize: 12, color: '#6B7280', marginTop: 5 },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: '#EEE',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  author: { fontFamily: FONTS.regular, fontSize: 12, color: '#9CA3AF' },
  flagBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  flagText: { fontFamily: FONTS.regular, fontSize: 12, color: '#999' },
  flaggedText: { fontFamily: FONTS.semibold, fontSize: 12, color: '#B45309' },
  errorText: { fontFamily: FONTS.regular, fontSize: 12, color: '#B45309', marginTop: 8 },
})
