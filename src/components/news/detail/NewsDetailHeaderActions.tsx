import { StyleSheet, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import IconButton from '../../common/IconButton'

interface Props {
  title: string
  bookmarked: boolean
  onShare: () => void
  onToggleBookmark: () => void
}

/** [소식 상세 머리 오른쪽] 공유·북마크 버튼. 읽어 주는 이름에 소식 제목을 붙인다. */
export default function NewsDetailHeaderActions({ title, bookmarked, onShare, onToggleBookmark }: Props) {
  return (
    <View style={styles.actions}>
      <IconButton
        icon="share-outline"
        color={COLORS.textSecondary}
        onPress={onShare}
        accessibilityLabel={`${title} 공유하기`}
      />
      <IconButton
        icon={bookmarked ? 'bookmark' : 'bookmark-outline'}
        color={bookmarked ? COLORS.primary : COLORS.textSecondary}
        onPress={onToggleBookmark}
        accessibilityLabel={bookmarked ? `${title} 북마크 해제` : `${title} 북마크`}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center' },
})
