import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { openExternalUrl } from '../../../utils/openExternalUrl'
import type { NewsAttachment } from '../../../types'

/** 상세 본문 아래 첨부파일 상자. 줄을 누르면 파일 주소를 바깥(브라우저)에서 연다. 없으면 그리지 않는다. */
export default function NewsAttachments({ attachments }: { attachments: NewsAttachment[] | undefined }) {
  if (!attachments || attachments.length === 0) return null
  return (
    <View style={styles.box}>
      <Text style={styles.label}>첨부파일 {attachments.length}</Text>
      {attachments.map((file) => (
        <TouchableOpacity
          key={file.url}
          style={styles.row}
          onPress={() => openExternalUrl(file.url)}
          accessibilityRole="link"
          accessibilityLabel={`${file.name} 내려받기`}
        >
          <Ionicons name="document-attach-outline" size={15} color={COLORS.primary} />
          <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: 14,
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  label: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: COLORS.primary },
})
