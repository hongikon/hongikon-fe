import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { splitLinks } from '../../../utils/news/newsBody'
import { openExternalUrl } from '../../../utils/common/openExternalUrl'
import { useNewsBody } from '../../../hooks/news/detail/useNewsBody'

/**
 * 크롤러가 가져온 본문을 정리해 보여 준다(utils/newsBody). 소제목·항목(굵은 라벨)·주의 문구·문단으로 나누고,
 * 본문 속 링크·메일은 눌러 열 수 있게 한다. 글자는 원문 그대로다.
 */
export default function NewsBody({ text }: { text: string }) {
  const { blocks } = useNewsBody({ text })
  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <Text key={index} style={styles.heading}>
              <Text style={styles.headingMarker}>{block.marker} </Text>
              <Inline text={block.text} />
            </Text>
          )
        }
        if (block.type === 'note') {
          return (
            <View key={index} style={styles.note}>
              <Text style={styles.noteText}>
                <Inline text={block.text} />
              </Text>
            </View>
          )
        }
        if (block.type === 'bullet') {
          return (
            <View key={index} style={[styles.bulletRow, block.depth === 1 && styles.bulletIndent]}>
              <Text style={styles.bulletMark}>{block.marker ?? '•'}</Text>
              <Text style={styles.bulletText}>
                {block.label ? <Text style={styles.label}>{`${block.label}  `}</Text> : null}
                <Inline text={block.text} />
              </Text>
            </View>
          )
        }
        return (
          <Text key={index} style={styles.paragraph}>
            <Inline text={block.text} />
          </Text>
        )
      })}
    </View>
  )
}

/** 글 한 덩어리 안의 링크·메일을 눌러 열 수 있게 나눠 그린다. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.kind === 'link' ? (
          <Text
            key={i}
            style={styles.link}
            onPress={() => openExternalUrl(part.url)}
            accessibilityRole="link"
          >
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        ),
      )}
    </>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 16 },
  paragraph: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 24, color: COLORS.textPrimary },
  heading: { fontFamily: FONTS.bold, fontSize: 16, lineHeight: 23, color: COLORS.textPrimary, marginTop: 8 },
  headingMarker: { color: COLORS.primary },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletIndent: { paddingLeft: 14 },
  bulletMark: { fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 23, color: COLORS.primary, minWidth: 10 },
  bulletText: { flex: 1, fontFamily: FONTS.regular, fontSize: 15, lineHeight: 23, color: COLORS.textPrimary },
  label: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  note: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 9 },
  noteText: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  link: { color: COLORS.primary, textDecorationLine: 'underline' },
})
