import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import ScreenHeader from '../common/ScreenHeader'
import { COLORS } from '../../constants/colors'
import { layoutStyles } from '../../constants/layout'
import { RADIUS, SPACING } from '../../constants/spacing'

interface ModalHeaderProps {
  title: string
  onClose: () => void
  /** 오른쪽 자리(완료 등) */
  right?: ReactNode
}

/**
 * 전체 화면 창(설정의 각 창)의 머리줄. 소식·설정 탭과 같은 둥근 흰 머리 카드(10-07)라
 * 창 바탕은 회색(COLORS.background)이어야 한다. 흰 바탕이 필요한 본문은 `ModalPanel` 에 담는다.
 */
export default function ModalHeader({ title, onClose, right }: ModalHeaderProps) {
  return <ScreenHeader title={title} onBack={onClose} right={right} card style={layoutStyles.readable} />
}

/**
 * 머리 카드 아래 남은 자리를 채우는 둥근 흰 판. 글·입력칸처럼 흰 바탕 위에 놓이던 본문을 담는다.
 * 설정 탭 묶음 카드와 같은 곡률·좌우 여백이고, 아래로는 화면 끝까지 이어진다.
 */
export function ModalPanel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.floating,
    borderTopRightRadius: RADIUS.floating,
    overflow: 'hidden',
  },
})
