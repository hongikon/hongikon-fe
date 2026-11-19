import type { ComponentProps, ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'

interface Props {
  icon: ComponentProps<typeof Ionicons>['name']
  text: string
  textStyle?: StyleProp<TextStyle>
  /** 글 옆에 붙는 링크 등. */
  children?: ReactNode
}

/** 제보 카드의 아이콘 + 한 줄 정보(장소·기간·작성자·등록일). */
export function ReportFact({ icon, text, textStyle, children }: Props) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={15} color={COLORS.textSecondary} />
      <Text style={[styles.factText, textStyle]}>{text}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  factText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.chipText, flexShrink: 1 },
})
