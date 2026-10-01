import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { CONTENT_MAX_WIDTH } from '../../constants/layout'

interface ContentColumnProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  maxWidth?: number
}

/**
 * 화면(또는 전체 화면 Modal) 내용을 가운데 한 줄 기둥에 담는다.
 * 바깥 배경은 부모가 화면 끝까지 칠하고, 내용만 `maxWidth` 에서 멈춘다 —
 * 폴드를 펼치거나 웹 창을 넓혀도 머리줄·본문이 같은 폭으로 가운데 정렬된다.
 * 좁은 화면에선 width 100% 라 감싸기 전과 똑같다.
 */
export default function ContentColumn({ children, style, maxWidth = CONTENT_MAX_WIDTH }: ContentColumnProps) {
  return <View style={[styles.column, { maxWidth }, style]}>{children}</View>
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', alignSelf: 'center' },
})
