import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from '../../common/Button'
import ContentColumn from '../../common/ContentColumn'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { SPACING } from '../../../constants/spacing'
import { tabStyles } from './tabStyles'

interface Props {
  topInset: number
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
  action?: { label: string; onPress: () => void }
}

/** 물어보기 탭 가운데 안내(쉬는 중·로그인 필요). 아래에 BETA 한 줄, 있으면 버튼. */
export default function AskNotice({ topInset, icon, title, body, action }: Props) {
  return (
    <View style={[tabStyles.root, styles.center, { paddingTop: topInset }]}>
      <ContentColumn style={styles.noticeColumn}>
        <View style={styles.noticeIcon}>
          <Ionicons name={icon} size={30} color={COLORS.primary} />
        </View>
        <View style={tabStyles.titleRow}>
          <Text style={tabStyles.title}>{title}</Text>
        </View>
        <Text style={styles.noticeBody}>{body}</Text>
        <Text style={styles.betaNote}>물어보기는 BETA(시험 운영) 기능이에요.</Text>
        {action ? (
          <View style={styles.noticeAction}>
            <Button label={action.label} onPress={action.onPress} />
          </View>
        ) : null}
      </ContentColumn>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
  noticeColumn: { alignItems: 'center', paddingHorizontal: SPACING.xl, paddingBottom: 120 },
  noticeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
  },
  noticeBody: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  betaNote: { marginTop: SPACING.sm, fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: 'center' },
  noticeAction: { marginTop: SPACING.lg, alignSelf: 'stretch' },
})
