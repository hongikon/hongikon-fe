import { StyleSheet, Text, View } from 'react-native'
import { facilityKindLabel } from '../../../constants/facilityKinds'
import { formatFloor } from '../../../utils/common/floors'
import type { AdminFacility } from '../../types'
import { termLabel, termPhase } from '../../utils/common/term'
import { adminText, Badge, Button, Card, ConfirmBar } from '../../ui'

interface Props {
  facility: AdminFacility
  /** 이 카드의 삭제 확인 줄이 열려 있다. */
  confirming: boolean
  deleting: boolean
  onEdit: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onRemove: () => void
}

/** '이용 불가 · 지금 ~ 12-01' · 기간 전이면 '이용 불가 예정 · …' · 지났으면 '이용 불가 기간 끝남(지도엔 열림)'. */
function unavailableBadge(facility: AdminFacility): { label: string; tone: 'danger' | 'warning' | 'neutral' } {
  const phase = termPhase(facility.unavailableFrom, facility.unavailableUntil, new Date())
  const term = termLabel(facility.unavailableFrom, facility.unavailableUntil)
  if (phase === 'upcoming') return { label: `이용 불가 예정 · ${term}`, tone: 'warning' }
  if (phase === 'ended') return { label: '이용 불가 기간 끝남(지도엔 열림)', tone: 'neutral' }
  return { label: `이용 불가 · ${term}`, tone: 'danger' }
}

/** 편의시설 목록 카드. 좌표가 없으면 '건물 좌표 사용'. */
export function FacilityCard({ facility, confirming, deleting, onEdit, onAskDelete, onCancelDelete, onRemove }: Props) {
  return (
    <Card>
      <View style={styles.itemHeader}>
        <Badge label={facilityKindLabel(facility.kind)} tone="info" />
        {facility.unavailable ? <Badge {...unavailableBadge(facility)} /> : null}
        <Text style={[adminText.strong, styles.itemTitle]}>
          {facility.buildingName}
          {typeof facility.floor === 'number' ? ` ${formatFloor(facility.floor)}` : ''}
        </Text>
      </View>
      {facility.note ? <Text style={adminText.body}>{facility.note}</Text> : null}
      {facility.unavailable && facility.unavailableReason ? (
        <Text style={adminText.body}>사유: {facility.unavailableReason}</Text>
      ) : null}
      <Text style={[adminText.muted, styles.meta]}>
        {facility.id}
        {typeof facility.lat === 'number' && typeof facility.lng === 'number' ? ` · ${facility.lat}, ${facility.lng}` : ' · 건물 좌표 사용'}
      </Text>
      {confirming ? (
        <ConfirmBar
          message={`정말 삭제할까요? ${facility.buildingName} ${facility.kind}이(가) 지도에서 바로 사라지고 되돌릴 수 없어요.`}
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
