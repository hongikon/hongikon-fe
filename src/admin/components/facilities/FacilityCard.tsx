import { StyleSheet, Text, View } from 'react-native'
import { facilityKindLabel } from '../../../constants/facilityKinds'
import { formatFloor } from '../../../utils/common/floors'
import type { AdminFacility } from '../../types'
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

/** 편의시설 목록 카드. 좌표가 없으면 '건물 좌표 사용'. */
export function FacilityCard({ facility, confirming, deleting, onEdit, onAskDelete, onCancelDelete, onRemove }: Props) {
  return (
    <Card>
      <View style={styles.itemHeader}>
        <Badge label={facilityKindLabel(facility.kind)} tone="info" />
        <Text style={[adminText.strong, styles.itemTitle]}>
          {facility.buildingName}
          {typeof facility.floor === 'number' ? ` ${formatFloor(facility.floor)}` : ''}
        </Text>
      </View>
      {facility.note ? <Text style={adminText.body}>{facility.note}</Text> : null}
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
