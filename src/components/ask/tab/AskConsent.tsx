import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Button from '../../common/Button'
import ContentColumn from '../../common/ContentColumn'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { RADIUS, SPACING } from '../../../constants/spacing'
import { tabStyles } from './tabStyles'

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.dot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

/** 물어보기 첫 사용 동의(국외 이전·1년 기록·개인정보 주의). 동의해야 대화가 열린다. */
export default function AskConsent({ topInset, onAccept }: { topInset: number; onAccept: () => void }) {
  return (
    <View style={[tabStyles.root, { paddingTop: topInset + SPACING.md }]}>
      <ScrollView contentContainerStyle={styles.consentScroll}>
        <ContentColumn>
          <View style={tabStyles.titleRow}>
            <Text style={tabStyles.title}>물어보기</Text>
            <Text style={tabStyles.beta}>BETA</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>시작하기 전에 확인해 주세요</Text>
            <Bullet text="학교 홈페이지 안내와 공지를 근거로 AI가 답해요. 시험 중인 기능이라 틀릴 수 있으니, 중요한 일정·조건은 답 아래 원문 링크나 담당 부서로 꼭 확인해 주세요." />
            <Bullet text="답을 쓰기 위해 질문과 직전 대화가 Anthropic(미국)의 AI 서버로 암호화되어 전송돼요." />
            <Bullet text="서비스 개선을 위해 질문·답·'해결됐나요' 응답(과 고른 이유)을 1년 동안 보관해요. 계정과 연결하지 않고, 학번·전화번호·이메일 형태는 가려서 저장해요." />
            <Bullet text="학번·연락처 같은 개인정보는 질문에 적지 말아 주세요." />
            <Bullet text="동의하지 않아도 다른 기능은 그대로 쓸 수 있어요." />
          </View>
          <Button label="동의하고 시작하기" onPress={onAccept} />
        </ContentColumn>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  consentScroll: { paddingHorizontal: SPACING.lg, paddingBottom: 140, gap: SPACING.lg },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: 12, marginBottom: SPACING.lg },
  cardTitle: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  bullet: { flexDirection: 'row', gap: 8 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.textTertiary, marginTop: 8 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21, fontFamily: FONTS.regular, color: COLORS.textSecondary },
})
