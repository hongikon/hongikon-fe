import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { RADIUS } from '../../../constants/spacing'
import * as haptics from '../../../lib/haptics'
import { notify } from '../../../utils/common/dialog'
import { permissionActions, pillKey, type PermissionView } from '../../../utils/settings/permissions'
import Button from '../../common/Button'

const PILL = {
  granted: { label: '허용됨', bg: COLORS.successSoft, fg: COLORS.success },
  limited: { label: '일부 허용', bg: COLORS.warningSoft, fg: COLORS.warning },
  denied: { label: '꺼짐', bg: COLORS.dangerSoft, fg: '#B91C1C' },
  undetermined: { label: '아직 묻지 않음', bg: COLORS.fill, fg: COLORS.textSecondary },
  loading: { label: '확인 중', bg: COLORS.fill, fg: COLORS.textTertiary },
  notNeeded: { label: '권한 필요 없음', bg: COLORS.fill, fg: COLORS.textSecondary },
} as const

function openPhoneSettings(what: string) {
  Linking.openSettings().catch(() =>
    notify('설정을 열지 못했어요', `휴대폰 설정 > 홍익온 > ${what}에서 바꿀 수 있어요.`),
  )
}

/** 권한 한 줄: 아이콘·이름·쓰는 곳·상태 알약, 아래에 허용하기/설정 열기/설정에서 바꾸기. */
export default function PermissionRow({
  icon,
  title,
  purpose,
  state,
  onRequest,
  settingsName,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  purpose: string
  state: PermissionView
  onRequest: () => void
  /** 휴대폰 설정에서 찾아갈 항목 이름(설정을 못 열 때 안내에 쓴다). */
  settingsName: string
}) {
  const pill = PILL[pillKey(state)]
  const { canAsk, blocked } = permissionActions(state)

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowPurpose}>{purpose}</Text>
        </View>
        <View
          style={[styles.pill, { backgroundColor: pill.bg }]}
          accessible
          accessibilityLabel={`${title} 권한 ${pill.label}`}
        >
          <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
        </View>
      </View>

      {canAsk && (
        <Button
          label="허용하기"
          size="md"
          onPress={() => {
            haptics.tapLight()
            onRequest()
          }}
          accessibilityLabel={`${title} 권한 허용하기`}
        />
      )}
      {blocked && (
        <Button
          label="설정 열기"
          variant="secondary"
          size="md"
          icon="open-outline"
          iconPosition="right"
          onPress={() => openPhoneSettings(settingsName)}
          accessibilityLabel={`휴대폰 설정에서 ${title} 권한 켜기`}
        />
      )}
      {state.kind === 'granted' && (
        <Pressable
          style={styles.linkBtn}
          onPress={() => openPhoneSettings(settingsName)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`휴대폰 설정에서 ${title} 권한 바꾸기`}
        >
          <Text style={styles.linkBtnText}>
            {state.limited ? '휴대폰 설정에서 전체 허용으로 바꾸기' : '휴대폰 설정에서 바꾸기'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { paddingVertical: 16, gap: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.textPrimary },
  rowPurpose: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: COLORS.textSecondary },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill },
  pillText: { fontFamily: FONTS.semibold, fontSize: 12 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 50, marginTop: -4 },
  linkBtnText: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
})
