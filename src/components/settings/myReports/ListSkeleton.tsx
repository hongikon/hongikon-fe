import { StyleSheet, View } from 'react-native'
import { RADIUS, SPACING } from '../../../constants/spacing'
import { SkeletonBlock, SkeletonGroup } from '../../common/Skeleton'
import { myReportsStyles as shared } from './styles'

/** 내 제보 내역을 처음 불러오는 동안 카드 세 장 모양. */
export default function ListSkeleton() {
  return (
    <SkeletonGroup style={shared.list} accessibilityLabel="내 제보 불러오는 중">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[shared.card, i > 0 && styles.skeletonGap]}>
          <SkeletonBlock width={88} height={22} radius={RADIUS.pill} />
          <SkeletonBlock width="70%" height={16} style={styles.skeletonLine} />
          <SkeletonBlock width="50%" height={12} style={styles.skeletonLine} />
          <SkeletonBlock width="60%" height={12} style={styles.skeletonLine} />
        </View>
      ))}
    </SkeletonGroup>
  )
}

const styles = StyleSheet.create({
  skeletonGap: { marginTop: SPACING.md },
  skeletonLine: { marginTop: SPACING.sm },
})
