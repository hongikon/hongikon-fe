import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import type { AdminAskFeedbackItem } from '../../types'

/** 같은 답에서 학생이 보낸 '운영진에게 물어보기' 문의(남긴 말·연락처·참고 사진). 답장·처리 완료는 문의 탭에서 한다. */
export function AskHandoffBox({ handoff }: { handoff: AdminAskFeedbackItem['handoffs'][number] }) {
  return (
    <View style={styles.handoff}>
      <Text style={styles.handoffTitle}>
        운영진에게 물어보기 · 문의 #{handoff.feedbackId} · {handoff.status === 'RESOLVED' ? '처리 완료' : '미처리'}
      </Text>
      <Text selectable style={styles.handoffText}>
        {handoff.content}
      </Text>
      {handoff.contact ? (
        <Text selectable style={styles.fact}>
          연락처 <Text style={styles.factStrong}>{handoff.contact}</Text>
        </Text>
      ) : null}
      {handoff.imageUrls.length > 0 ? (
        <View style={styles.images}>
          {handoff.imageUrls.map((url, index) => (
            <Pressable
              key={url}
              onPress={() => Linking.openURL(url).catch(() => {})}
              accessibilityRole="imagebutton"
              accessibilityLabel={`참고 사진 ${index + 1} 크게 보기`}
            >
              <Image source={{ uri: url }} style={styles.image} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  fact: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  factStrong: { fontFamily: FONTS.medium, color: COLORS.textPrimary },
  handoff: { gap: 6, padding: 10, borderRadius: 10, backgroundColor: COLORS.background },
  handoffTitle: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textSecondary },
  handoffText: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: COLORS.textPrimary },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  image: { width: 88, height: 88, borderRadius: 8, backgroundColor: COLORS.border },
})
