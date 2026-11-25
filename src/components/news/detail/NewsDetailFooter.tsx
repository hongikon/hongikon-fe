import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SPACING } from '../../../constants/spacing'
import { layoutStyles } from '../../../constants/layout'
import Button from '../../common/Button'
import { openExternalUrl } from '../../../utils/common/openExternalUrl'
import { HONGIK_HOME_URL, originalLinkLabels } from '../../../utils/news/detail'

/**
 * [원문 보기] 화면 아래에 하나만 고정해 둔다 — 본문을 어디까지 읽었든 바로 누를 수 있다(예전엔 위·아래 두 개였다).
 * 원문 링크가 없으면 학교 홈페이지를 연다. 넓은 화면에선 본문과 같은 읽기 너비(layoutStyles.readable)에 맞춘다.
 */
export default function NewsDetailFooter({ link }: { link: string | undefined }) {
  const insets = useSafeAreaInsets()
  const { label, a11yLabel } = originalLinkLabels(link)
  const openOriginal = () => openExternalUrl(link, HONGIK_HOME_URL)
  return (
    <View style={[layoutStyles.readable, styles.footer, { paddingBottom: 12 + insets.bottom }]}>
      <Button
        icon="open-outline"
        label={label}
        onPress={openOriginal}
        accessibilityRole="link"
        accessibilityLabel={a11yLabel}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  // 원문 보기: 회색 바탕 위에 떠 있는 버튼만. 좌우 12 로 위 본문 판 가장자리와 맞춘다(10-08, 예전 흰 바 + 윗선 + 20).
  footer: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
  },
})
