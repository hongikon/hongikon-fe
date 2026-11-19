import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../../constants/colors'
import { FONTS } from '../../../../constants/typography'
import OfficialBadge from '../../../common/OfficialBadge'

interface ReportSheetFooterProps {
  authorName: string
  authorOfficial: boolean
  edited: boolean
  isMine: boolean
  flagging: boolean
  flagged: boolean
  /** 내 제보 ⋯ 메뉴가 있는지(알림·시간 수정·수정/삭제 중 하나라도). */
  hasOwnerMenu: boolean
  /** ⋯ 메뉴 접근성 라벨(메뉴에 있는 항목을 읽어 준다). */
  ownerMenuLabel: string
  onOpenOwnerMenu: () => void
  onOpenModerationMenu: () => void
}

/** 제보 시트 아래 줄: 작성자(공식·수정됨)와 ⋯(내 제보)·⋮(남의 제보: 숨기기·신고) 버튼. */
export default function ReportSheetFooter({
  authorName,
  authorOfficial,
  edited,
  isMine,
  flagging,
  flagged,
  hasOwnerMenu,
  ownerMenuLabel,
  onOpenOwnerMenu,
  onOpenModerationMenu,
}: ReportSheetFooterProps) {
  return (
    <View style={styles.footer}>
      <View style={styles.authorRow}>
        <Text style={styles.author} numberOfLines={1}>{authorName}</Text>
        {authorOfficial ? <OfficialBadge /> : null}
        {edited ? <Text style={styles.edited}>수정됨</Text> : null}
      </View>
      <View style={styles.actions}>
        {flagging ? (
          <ActivityIndicator size="small" color={COLORS.textTertiary} />
        ) : flagged ? (
          <Text style={styles.flaggedText}>신고 접수됨</Text>
        ) : null}
        {/* 내 제보는 ⋯ 에 "이 제보 알림 끄기/켜기"(서버가 notifyEnabled 를 줄 때만). */}
        {hasOwnerMenu && (
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={onOpenOwnerMenu}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={ownerMenuLabel}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
        {/* 내 제보에는 숨기기·신고가 필요 없다. 남의 제보는 ⋮ 메뉴 하나로 모은다. */}
        {!isMine && (
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={onOpenModerationMenu}
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
  )
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  author: { flexShrink: 1, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  edited: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginLeft: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  moreBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  flaggedText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.warningIcon },
})
