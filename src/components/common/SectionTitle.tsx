import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { COLORS } from '../../constants/colors'
import { TYPE } from '../../constants/typography'
import { SPACING } from '../../constants/spacing'

interface SectionTitleProps {
  title: string
  /** 오른쪽 작은 글자(개수 등) */
  meta?: string
  /** 제목 아래 한두 줄 설명 */
  description?: string
  right?: ReactNode
  style?: StyleProp<ViewStyle>
}

/** 설정처럼 줄을 묶는 섹션의 이름. 화면마다 10px 회색·11px 굵은 글자처럼 제각각이던 것을 한 모양으로 맞춘다. */
export default function SectionTitle({ title, meta, description, right, style }: SectionTitleProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {meta !== undefined && <Text style={styles.meta}>{meta}</Text>}
        {right}
      </View>
      {description !== undefined && <Text style={styles.description}>{description}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.xs, gap: SPACING.xxs },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  title: { ...TYPE.section, flex: 1, color: COLORS.textSecondary },
  meta: { ...TYPE.caption, color: COLORS.textTertiary },
  description: { ...TYPE.caption, color: COLORS.textSecondary },
})
