import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import ListRow from '../../../common/ListRow'
import ToggleSwitch from '../../ToggleSwitch'
import { COLORS } from '../../../../constants/colors'
import { FONTS, TYPE } from '../../../../constants/typography'
import { RADIUS, SPACING } from '../../../../constants/spacing'
import type { NotificationPermission } from '../../../../lib/notificationPermission'
import { masterAlertDescription } from '../../../../utils/settings/alerts'

interface Props {
  isGuest: boolean
  /** 게스트면 늘 false. */
  subscriptionAlert: boolean
  /** 휴대폰 알림 권한이 막혔거나 아직 묻지 않았다. */
  systemBlocked: boolean
  permission: NotificationPermission
  onToggle: () => void
  onFixPermission: () => void
}

/** 알림 묶음 첫 칸: 게스트 안내 · '알림 받기' 전체 스위치 · 휴대폰 권한이 막혔을 때 안내 카드. */
export default function MasterAlertBlock({ isGuest, subscriptionAlert, systemBlocked, permission, onToggle, onFixPermission }: Props) {
  const cannotAsk = permission.status === 'denied' && !permission.canAskAgain
  return (
    <View style={styles.subBlockFirst}>
      {isGuest && (
        <View style={styles.guestNotice}>
          <Ionicons name="lock-closed-outline" size={15} color={COLORS.primary} />
          <View style={styles.guestNoticeBody}>
            <Text style={styles.guestNoticeTitle}>알림은 로그인 후 받을 수 있어요</Text>
            <Text style={styles.guestNoticeText}>
              로그인하면 계정에 저장된 알림 설정을 불러와요. 구독한 게시판은 로그인하지 않아도 소식 탭에서 볼 수 있어요.
            </Text>
          </View>
        </View>
      )}
      <ListRow
        icon="notifications-outline"
        label="알림 받기"
        description={masterAlertDescription(isGuest, subscriptionAlert)}
        last
        right={
          <ToggleSwitch
            value={subscriptionAlert}
            dimmed={isGuest}
            onToggle={onToggle}
            locked={isGuest}
            accessibilityLabel="알림 받기"
          />
        }
      />
      {/* subscriptionAlert 는 로그인했을 때만 true 다. */}
      {subscriptionAlert && !isGuest && systemBlocked && (
        <View style={styles.permissionCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.warningIcon} />
          <Text style={styles.permissionText}>
            {permission.status === 'denied'
              ? '휴대폰 설정에서 홍익온 알림이 꺼져 있어 알림이 오지 않아요.'
              : '알림을 받으려면 휴대폰 알림 권한을 허용해 주세요.'}
          </Text>
          <TouchableOpacity
            onPress={onFixPermission}
            accessibilityRole="button"
            accessibilityLabel={cannotAsk ? '휴대폰 설정 열기' : '알림 허용하기'}
          >
            <Text style={styles.permissionAction}>{cannotAsk ? '설정 열기' : '허용하기'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  subBlockFirst: { backgroundColor: COLORS.white },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },
  guestNoticeBody: { flex: 1, gap: SPACING.xxs },
  guestNoticeTitle: { ...TYPE.callout, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  guestNoticeText: { ...TYPE.caption, color: COLORS.textSecondary },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningSoft,
  },
  permissionText: { ...TYPE.caption, flex: 1, color: COLORS.warning },
  permissionAction: { ...TYPE.callout, fontFamily: FONTS.semibold, color: COLORS.primary },
})
