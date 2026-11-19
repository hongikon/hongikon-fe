import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { getErrorMessage } from '../../../apis/client'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { formatDateTime, formatRelative } from '../../format'
import { AskNoteForm } from '../../screens/AskInsightViews'
import type { AdminAskFeedbackItem } from '../../types'
import { Badge, Button, Card, InlineError } from '../../ui'
import { ASK_REASON_LABELS, ASK_REASON_TONES } from '../../utils/askFeedback'
import { AskHandoffBox } from './AskHandoffBox'

/**
 * 피드백 한 건: 이유·출처 배지, 질문·답(길면 접힘), 안내·근거, 같은 답에서 온 운영진 문의, '안내로 등록'·'확인함'.
 */
export function AskFeedbackCard({
  item,
  onReview,
}: {
  item: AdminAskFeedbackItem
  onReview: (item: AdminAskFeedbackItem, reviewed: boolean) => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [writing, setWriting] = useState(false)
  const [noted, setNoted] = useState(false)
  const reviewed = item.reviewedAt !== null

  const toggle = () => {
    setPending(true)
    setError(null)
    onReview(item, !reviewed)
      .catch((err: unknown) => setError(getErrorMessage(err, '상태를 바꾸지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setPending(false))
  }

  return (
    <Card style={[styles.card, reviewed && styles.cardReviewed]}>
      <View style={styles.top}>
        <View style={styles.badges}>
          {item.reason ? (
            <Badge label={ASK_REASON_LABELS[item.reason]} tone={ASK_REASON_TONES[item.reason]} />
          ) : (
            <Badge label={ASK_REASON_LABELS.NONE} />
          )}
          <Badge label={item.source === 'ROUTE' ? '서버 답' : '안내 흐름'} tone="info" />
          {item.handoffs.length > 0 ? <Badge label={`문의 ${item.handoffs.length}`} tone="warning" /> : null}
          {reviewed ? <Badge label="확인함" tone="success" /> : null}
        </View>
        <Text style={styles.meta}>
          {formatDateTime(item.createdAt)} ({formatRelative(item.createdAt)})
        </Text>
      </View>

      <Text selectable style={styles.question}>
        Q. {item.question}
      </Text>
      {item.answer ? (
        <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityLabel={open ? '답 접기' : '답 펼치기'}>
          <Text selectable style={styles.answer} numberOfLines={open ? undefined : 5}>
            {item.answer}
          </Text>
          {item.answer.length > 240 ? <Text style={styles.more}>{open ? '접기' : '펼치기'}</Text> : null}
        </Pressable>
      ) : null}

      <View style={styles.facts}>
        {item.flowId ? (
          <Text selectable style={styles.fact}>
            안내 <Text style={styles.factStrong}>{item.flowId}/{item.nodeId ?? '-'}</Text>
          </Text>
        ) : null}
        {item.nodeIds.length > 0 ? (
          <Text selectable style={styles.fact}>
            고른 안내 <Text style={styles.factStrong}>{item.nodeIds.join(', ')}</Text>
          </Text>
        ) : null}
        {item.references.length > 0 ? (
          <Text selectable style={styles.fact}>
            근거 <Text style={styles.factStrong}>{item.references.join(' · ')}</Text>
          </Text>
        ) : null}
        <Text style={styles.fact}>
          #{item.source === 'ROUTE' ? 'R' : 'F'}
          {item.id}
        </Text>
      </View>

      {item.handoffs.map((handoff) => (
        <AskHandoffBox key={handoff.feedbackId} handoff={handoff} />
      ))}

      {writing ? (
        <AskNoteForm
          initialQuestion={item.question}
          askRef={item.source === 'ROUTE' ? `route:${item.id}` : null}
          onSaved={() => {
            setWriting(false)
            setNoted(true)
          }}
          onCancel={() => setWriting(false)}
        />
      ) : null}
      {noted ? <Text style={styles.fact}>운영진 확인 안내로 등록했어요. '운영진 안내'에서 고치거나 끌 수 있어요.</Text> : null}
      <View style={styles.actions}>
        {!writing ? <Button label="안내로 등록" icon="add" onPress={() => setWriting(true)} small /> : null}
        <Button
          label={reviewed ? '되돌리기' : '확인함'}
          icon={reviewed ? 'arrow-undo-outline' : 'checkmark'}
          variant={reviewed ? 'secondary' : 'primary'}
          onPress={toggle}
          loading={pending}
          small
        />
      </View>
      {error ? <InlineError message={error} /> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  cardReviewed: { opacity: 0.75 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  question: { fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 22, color: COLORS.textPrimary },
  answer: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.textPrimary },
  more: { marginTop: 2, fontFamily: FONTS.medium, fontSize: 12, color: COLORS.primary },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  fact: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  factStrong: { fontFamily: FONTS.medium, color: COLORS.textPrimary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
})
