import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import ListRow from '../../../common/ListRow'
import { SELECTED_PILL_BG } from '../../../common/Chip'
import ToggleSwitch from '../../ToggleSwitch'
import { ALL_CATEGORIES } from '../../../../contexts/SettingsContext'
import { COLORS } from '../../../../constants/colors'
import { FONTS, TYPE } from '../../../../constants/typography'
import { RADIUS, SPACING } from '../../../../constants/spacing'
import { notify } from '../../../../utils/common/dialog'
import { boardAlertsValue, subscriptionNewsDescription } from '../../../../utils/settings/alerts'
import { settingsStyles as s } from '../styles'

type Category = (typeof ALL_CATEGORIES)[number]

interface Props {
  isGuest: boolean
  loggedIn: boolean
  /** 전체 알림이 꺼져 있으면 흐리게. */
  dimmed: boolean
  subscribedCount: number
  alertOnCount: number
  subscriptionNewsOn: boolean
  alertCategories: readonly string[]
  /** 게스트면 로그인 안내로 바꿔 준다. */
  guarded: (action: () => void) => () => void
  promptAlertLogin: () => void
  onToggleSubscriptionNews: () => void
  onToggleCategory: (cat: Category) => void
  onOpenBoardAlerts: () => void
  onOpenKeywords: () => void
}

/** 공지(구독 게시판) 알림 칸: 구독 알림 · 알림 받을 분야 · 게시판별 알림 · 키워드 알림. */
export default function NoticeAlertsBlock({
  isGuest,
  loggedIn,
  dimmed,
  subscribedCount,
  alertOnCount,
  subscriptionNewsOn,
  alertCategories,
  guarded,
  promptAlertLogin,
  onToggleSubscriptionNews,
  onToggleCategory,
  onOpenBoardAlerts,
  onOpenKeywords,
}: Props) {
  return (
    <View style={[s.subBlock, dimmed && s.dimmed]}>
      <Text style={s.subHeader}>공지 알림</Text>
      <ListRow
        icon="newspaper-outline"
        label="구독 알림"
        description={subscriptionNewsDescription(isGuest, alertOnCount, subscribedCount)}
        right={
          <ToggleSwitch
            value={!isGuest && subscriptionNewsOn}
            onToggle={guarded(onToggleSubscriptionNews)}
            locked={isGuest}
            accessibilityLabel={`구독 알림 ${subscriptionNewsOn ? '켜짐' : '꺼짐'}`}
          />
        }
      />
      {/* 분야는 구독 알림을 거르는 설정이라 구독 알림 바로 아래(11-01). */}
      <View style={styles.categoryHead}>
        <Text style={styles.categoryTitle}>알림 받을 분야</Text>
        <Text style={styles.categoryMeta}>
          {isGuest ? '로그인 후 사용' : `${alertCategories.length}/${ALL_CATEGORIES.length}`}
        </Text>
      </View>
      <Text style={styles.categoryHint}>구독한 게시판의 새 소식 중 고른 분야만 알려드려요</Text>
      <View style={styles.categoryGrid}>
        {ALL_CATEGORIES.map((cat) => {
          const isOn = alertCategories.includes(cat)
          // 켜진 분야는 분야별 색 대신 앱 기본색(남색)으로 통일한다.
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, isOn ? styles.categoryChipOn : styles.categoryChipOff]}
              onPress={guarded(() => onToggleCategory(cat))}
              activeOpacity={0.7}
              accessibilityRole="switch"
              accessibilityLabel={`${cat} 분야 알림 ${isOn ? '켜짐' : '꺼짐'}`}
              accessibilityState={{ checked: isOn }}
            >
              <Ionicons
                name={isOn ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={isOn ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.categoryChipText, { color: isOn ? COLORS.primary : COLORS.textSecondary }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      {loggedIn && alertCategories.length === 0 && (
        <View style={styles.warnRow}>
          <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
          <Text style={styles.warnText}>선택한 분야가 없어 새 소식 알림이 오지 않아요</Text>
        </View>
      )}
      {/* 구독이 많으면 목록이 끝없이 길어져 게시판별 알림은 따로 연다(BoardAlertsModal). 게스트는 로그인을 권한다. */}
      <ListRow
        icon="notifications-circle-outline"
        label="게시판별 알림"
        value={boardAlertsValue(isGuest, alertOnCount, subscribedCount)}
        onPress={isGuest ? promptAlertLogin : onOpenBoardAlerts}
      />
      {/* 키워드는 서버에만 저장해 게스트는 열지 않고 로그인 안내만 한다. */}
      <ListRow
        icon="pricetag-outline"
        label="키워드 알림"
        value={isGuest ? '로그인 후 사용' : undefined}
        onPress={() => (isGuest ? notify('키워드 알림', '키워드 알림은 로그인 후 쓸 수 있어요.') : onOpenKeywords())}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  categoryHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  categoryTitle: { flex: 1, fontFamily: FONTS.medium, fontSize: 16, lineHeight: 22, color: COLORS.textPrimary },
  categoryMeta: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textTertiary },
  categoryHint: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: COLORS.textSecondary, paddingHorizontal: SPACING.lg, paddingTop: 2, paddingBottom: SPACING.md },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    height: 34,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  // 켜짐: 회색 알약 + 남색 글자·체크(10-08, 앱 전체 선택 표시와 같게). 꺼짐: 흰 바탕 + 테두리 + 회색 글자.
  categoryChipOn: {
    backgroundColor: SELECTED_PILL_BG,
    borderColor: 'transparent',
  },
  categoryChipOff: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  categoryChipText: { ...TYPE.label, fontSize: 15, lineHeight: 20 },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    marginTop: -SPACING.xs,
  },
  warnText: { ...TYPE.caption, color: COLORS.danger },
})
