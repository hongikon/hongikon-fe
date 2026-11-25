import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import type { AdminWalkRestriction } from '../../types'
import { adminText, Badge, Button, Card, ConfirmBar } from '../../ui'
import { CAUSE_LABELS, KIND_LABELS } from '../../utils/roads/roadMap'
import { termLabel } from '../../utils/common/term'

interface Props {
  restriction: AdminWalkRestriction
  confirming: boolean
  removing: boolean
  onAskRemove: () => void
  onCancelRemove: () => void
  onRemove: () => void
}

const PHASE: Record<AdminWalkRestriction['phase'], { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  ACTIVE: { label: '막는 중', tone: 'danger' },
  UPCOMING: { label: '예정', tone: 'warning' },
  ENDED: { label: '끝남', tone: 'neutral' },
}

/** 통행 제한 한 줄. 기간 전이면 '예정', 지났으면 '끝남'(길찾기는 그때 이곳을 그대로 쓴다). */
export function RestrictionCard({ restriction, confirming, removing, onAskRemove, onCancelRemove, onRemove }: Props) {
  return (
    <Card>
      <View style={styles.header}>
        {restriction.purpose === 'CLOSURE' ? (
          <Ionicons name="ban" size={16} color={restriction.active ? COLORS.danger : COLORS.textTertiary} accessibilityLabel="통행 불가" />
        ) : (
          <Ionicons name="git-branch-outline" size={16} color={COLORS.textSecondary} accessibilityLabel="길 규칙" />
        )}
        {restriction.purpose === 'CLOSURE' ? (
          <>
            <Badge label={PHASE[restriction.phase].label} tone={PHASE[restriction.phase].tone} />
            <Badge label={CAUSE_LABELS[restriction.cause ?? 'OTHER']} tone="warning" />
          </>
        ) : (
          <Badge label="상시" tone="info" />
        )}
        <Badge label={KIND_LABELS[restriction.kind]} tone="neutral" />
        <Text style={[adminText.strong, styles.title]}>{restriction.label}</Text>
      </View>
      {restriction.reason ? <Text style={adminText.body}>사유: {restriction.reason}</Text> : null}
      <Text style={[adminText.muted, styles.meta]}>
        {restriction.purpose === 'CLOSURE' ? `${termLabel(restriction.startsAt, restriction.endsAt)} · ` : '늘 적용 · '}
        {restriction.target}
      </Text>
      {confirming ? (
        <ConfirmBar
          message={
            restriction.purpose === 'RULE'
              ? `${restriction.label} 규칙을 지울까요? 길찾기가 바로 다시 이곳을 씁니다.`
              : `${restriction.label} 통제를 풀까요? 길찾기가 바로 다시 이곳을 씁니다.`
          }
          confirmLabel="풀기"
          busy={removing}
          onConfirm={onRemove}
          onCancel={onCancelRemove}
        />
      ) : (
        <View style={styles.actions}>
          <Button
            label={restriction.purpose === 'RULE' ? '규칙 지우기' : '풀기'}
            icon={restriction.purpose === 'RULE' ? 'trash-outline' : 'lock-open-outline'}
            variant="ghost"
            onPress={onAskRemove}
            small
          />
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  title: { fontSize: 15 },
  meta: { marginTop: 4, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
})
