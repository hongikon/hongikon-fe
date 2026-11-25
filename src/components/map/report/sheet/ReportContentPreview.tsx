import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../../constants/colors'
import { FONTS } from '../../../../constants/typography'
import { CONTENT_PREVIEW_LINES, contentNeedsMore, contentPreview } from '../../../../utils/map/report/reportSheet'

interface ReportContentPreviewProps {
  content: string
  /** 두 줄을 넘었다고 onTextLayout 이 알려 왔는지(제보가 바뀌면 부모가 되돌린다). */
  clamped: boolean
  onClamped: () => void
  /** '본문 보기' — 제보 본문 창을 연다. */
  onOpenPost: () => void
}

/** 제보 본문 두 줄 미리보기. 다 안 들어가면(줄바꿈·길이) '본문 보기'를 띄운다. */
export default function ReportContentPreview({ content, clamped, onClamped, onOpenPost }: ReportContentPreviewProps) {
  return (
    <View style={styles.contentBox}>
      <Text
        style={styles.contentText}
        numberOfLines={CONTENT_PREVIEW_LINES}
        onTextLayout={(event) => {
          if (event.nativeEvent.lines.length > CONTENT_PREVIEW_LINES) onClamped()
        }}
      >
        {contentPreview(content)}
      </Text>
      {(clamped || contentNeedsMore(content)) && (
        <Pressable
          onPress={onOpenPost}
          hitSlop={8}
          style={({ pressed }) => [styles.contentMore, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="제보 본문 전체 보기"
        >
          <Text style={styles.contentMoreText}>본문 보기</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  contentBox: { marginTop: 10, gap: 6 },
  contentText: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: COLORS.textPrimary },
  contentMore: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  contentMoreText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.primary },
})
