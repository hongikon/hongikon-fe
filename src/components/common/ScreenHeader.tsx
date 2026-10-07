import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { COLORS } from '../../constants/colors'
import { TYPE } from '../../constants/typography'
import { HEADER_HEIGHT, ICON_BUTTON_SIZE, RADIUS, SPACING } from '../../constants/spacing'
import IconButton from './IconButton'

interface ScreenHeaderProps {
  title?: string
  /** 있으면 왼쪽에 뒤로 가기(또는 닫기) 버튼을 그린다. */
  onBack?: () => void
  /** 'back' ← (쌓인 화면·전체 화면 창) · 'close' ✕ (아래에서 올라온 시트) */
  backIcon?: 'back' | 'close'
  /** 오른쪽 자리(완료 글자·북마크 아이콘 등). 없으면 제목이 가운데 오도록 빈 칸을 둔다. */
  right?: ReactNode
  /** 제목 대신 가운데를 채울 내용(검색창 등). */
  children?: ReactNode
  /** 아래 구분선. 바로 밑에 탭·칩 줄이 붙으면 끈다. */
  border?: boolean
  /**
   * 회색 바탕 위에 떠 있는 둥근 흰 카드로 그린다(10-07 — 소식·설정 탭 머리 카드와 같은 모양). 뒤로 가기는 회색 원 버튼.
   * 이때 화면 바탕은 회색(COLORS.background)이어야 카드가 떠 보인다.
   */
  card?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * 뒤로 가기가 있는 화면·창의 머리줄. 소식 상세·학과 소식·검색·설정의 모든 창이 같은 높이·아이콘·제목 글꼴을 쓴다.
 * 탭 화면 맨 위 큰 제목은 `LargeTitleHeader` 를 쓴다.
 */
export default function ScreenHeader({
  title,
  onBack,
  backIcon = 'back',
  right,
  children,
  border = true,
  card = false,
  style,
}: ScreenHeaderProps) {
  const row = (
    <View style={[styles.header, card ? styles.cardRow : border && styles.border, card ? null : style]}>
      {onBack ? (
        <IconButton
          icon={backIcon === 'close' ? 'close' : 'arrow-back'}
          onPress={onBack}
          accessibilityLabel={backIcon === 'close' ? '닫기' : '뒤로 가기'}
          style={card ? styles.circle : undefined}
        />
      ) : (
        <View style={styles.slot} />
      )}
      {children ?? (
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      )}
      {right ?? (children ? null : <View style={styles.slot} />)}
    </View>
  )
  if (!card) return row
  return <View style={[styles.cardOuter, style]}>{row}</View>
}

/** 탭 화면(소식·설정) 맨 위의 큰 제목 줄. 오른쪽에 검색 같은 아이콘 버튼을 둘 수 있다. */
export function LargeTitleHeader({
  title,
  right,
  style,
}: {
  title: string
  right?: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.large, style]}>
      <Text style={styles.largeTitle} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xs + 2,
    backgroundColor: COLORS.white,
  },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  cardOuter: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  cardRow: {
    height: HEADER_HEIGHT + 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sheet,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  circle: { backgroundColor: COLORS.background },
  slot: { width: ICON_BUTTON_SIZE, height: ICON_BUTTON_SIZE },
  title: { ...TYPE.headline, flex: 1, textAlign: 'center', color: COLORS.textPrimary },
  large: {
    minHeight: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.xs + 2,
    backgroundColor: COLORS.white,
  },
  largeTitle: { ...TYPE.screenTitle, color: COLORS.textPrimary },
})
