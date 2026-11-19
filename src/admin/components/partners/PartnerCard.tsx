import { StyleSheet, Text, View } from 'react-native'
import { formStyles, TextRow } from '../../MapForm'
import type { AdminPartner } from '../../types'
import { adminText, Badge, Button, Card, ConfirmBar } from '../../ui'

interface Props {
  partner: AdminPartner
  /** 이 카드의 삭제 확인 줄이 열려 있다. */
  confirming: boolean
  deleting: boolean
  confirmName: string
  onChangeConfirmName: (text: string) => void
  deleteError: string | null
  onEdit: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onRemove: () => void
}

/** 제휴업체 목록 카드. 삭제는 업체 이름을 그대로 입력해야 눌린다. */
export function PartnerCard({
  partner,
  confirming,
  deleting,
  confirmName,
  onChangeConfirmName,
  deleteError,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onRemove,
}: Props) {
  return (
    <Card>
      <View style={styles.itemHeader}>
        <Text style={[adminText.strong, styles.itemTitle]}>{partner.name}</Text>
        <Badge label={partner.category} tone="info" />
        {partner.mapIcon ? <Badge label={`아이콘: ${partner.mapIcon}`} /> : null}
      </View>
      {partner.affiliations?.length ? <Text style={adminText.muted}>{partner.affiliations.join(' · ')}</Text> : null}
      {partner.benefit ? <Text style={adminText.body}>{partner.benefit}</Text> : null}
      {partner.affiliationBenefits?.map((item) => (
        <Text key={item.affiliation} style={adminText.muted}>
          {item.affiliation}: {item.benefit}
        </Text>
      ))}
      {partner.address ? <Text style={adminText.muted}>{partner.address}</Text> : null}
      {partner.endsOn ? <Text style={adminText.muted}>{partner.endsOn} 까지</Text> : null}
      <Text style={[adminText.muted, styles.meta]}>
        {partner.id} · {partner.lat}, {partner.lng}
      </Text>
      {confirming ? (
        <ConfirmBar
          message="정말 삭제할까요? 지도·검색에서 바로 사라지고 되돌릴 수 없어요. 확인을 위해 업체 이름을 그대로 입력해 주세요."
          confirmLabel="삭제"
          danger
          busy={deleting}
          confirmDisabled={confirmName.trim() !== partner.name}
          onConfirm={onRemove}
          onCancel={onCancelDelete}
        >
          <TextRow
            value={confirmName}
            onChangeText={onChangeConfirmName}
            placeholder={partner.name}
            maxLength={100}
            accessibilityLabel={`지울 업체 이름 입력: ${partner.name}`}
          />
          {deleteError ? (
            <Text style={formStyles.errorText} accessibilityRole="alert">
              {deleteError}
            </Text>
          ) : null}
        </ConfirmBar>
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
