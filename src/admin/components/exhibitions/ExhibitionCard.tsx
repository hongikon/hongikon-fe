import { StyleSheet, Text, View } from 'react-native'
import { daysUntilStart, dDayLabel, formatExhibitionPeriod, type ExhibitionPhase } from '../../../utils/exhibitions'
import type { AdminExhibition } from '../../types'
import { adminText, Badge, Button, Card, ConfirmBar } from '../../ui'

interface Props {
  exhibition: AdminExhibition
  phase: ExhibitionPhase
  /** 한국 날짜 일련번호(예정 전시의 D-day 계산). */
  today: number
  /** 전시장 이름(못 찾으면 코드 + '전시장 정보 없음'). */
  venueName: string
  /** 이 카드의 삭제 확인 줄이 열려 있다. */
  confirming: boolean
  deleting: boolean
  onEdit: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onRemove: () => void
}

/** 전시 목록 카드. 진행 단계 배지(진행 중·D-day·종료)와 전시장·기간·관람 시간·설명·링크. */
export function ExhibitionCard({
  exhibition,
  phase,
  today,
  venueName,
  confirming,
  deleting,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onRemove,
}: Props) {
  return (
    <Card>
      <View style={styles.itemHeader}>
        {phase === 'current' ? <Badge label="진행 중" tone="info" /> : null}
        {phase === 'upcoming' ? <Badge label={dDayLabel(daysUntilStart(exhibition, today))} tone="warning" /> : null}
        {phase === 'past' ? <Badge label="종료" /> : null}
        <Text style={[adminText.strong, styles.itemTitle]}>{exhibition.title}</Text>
      </View>
      <Text style={adminText.body}>
        {venueName} · {formatExhibitionPeriod(exhibition)}
      </Text>
      {exhibition.hours ? <Text style={[adminText.muted, styles.meta]}>관람 시간 {exhibition.hours}</Text> : null}
      {exhibition.description ? (
        <Text style={[adminText.muted, styles.meta]} numberOfLines={2}>
          {exhibition.description}
        </Text>
      ) : null}
      {exhibition.link ? (
        <Text style={[adminText.muted, styles.meta]} numberOfLines={1}>
          링크: {exhibition.link.label} · {exhibition.link.url}
        </Text>
      ) : null}
      {confirming ? (
        <ConfirmBar
          message={`정말 삭제할까요? '${exhibition.title}' 전시가 지도에서 바로 사라지고 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          danger
          busy={deleting}
          onConfirm={onRemove}
          onCancel={onCancelDelete}
        />
      ) : (
        <View style={styles.itemActions}>
          <Button label="수정" icon="create-outline" onPress={onEdit} small />
          <Button label="삭제" icon="trash-outline" variant="ghost" onPress={onAskDelete} small />
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  itemHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  itemTitle: { fontSize: 15 },
  meta: { marginTop: 4, fontSize: 12 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
})
