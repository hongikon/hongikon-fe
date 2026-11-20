import { StyleSheet, Text, View } from 'react-native'
import { parseServerTime } from '../../../utils/serverTime'
import type { AdminNotice } from '../../types'
import { adminText, Badge, Button, Card, ConfirmBar } from '../../ui'
import { formatKst, type NoticePhase } from '../../utils/noticeDraft'

interface Props {
  notice: AdminNotice
  phase: NoticePhase
  /** 화면을 그린 시각(팝업이 아직 떠 있는지 가른다). */
  now: number
  /** 이 카드의 삭제 확인 줄이 열려 있다. */
  confirming: boolean
  deleting: boolean
  onEdit: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onRemove: () => void
}

/** 앱 공지 목록 카드: 예약·게시 중·팝업 배지, 게시·팝업 시각, 팝업 문구, 본문 앞부분. */
export function NoticeCard({ notice, phase, now, confirming, deleting, onEdit, onAskDelete, onCancelDelete, onRemove }: Props) {
  const publishMs = parseServerTime(notice.publishAt)
  const untilMs = notice.popupUntil ? parseServerTime(notice.popupUntil) : NaN
  const popupLive = Number.isFinite(untilMs) && now < untilMs
  return (
    <Card>
      <View style={styles.itemHeader}>
        {phase === 'scheduled' ? <Badge label="예약" tone="warning" /> : <Badge label="게시 중" tone="success" />}
        {popupLive ? <Badge label={phase === 'scheduled' ? '팝업 예약' : '팝업 중'} tone="info" /> : null}
        <Text style={[adminText.strong, styles.itemTitle]}>{notice.title}</Text>
      </View>
      <Text style={adminText.body}>
        {phase === 'scheduled' ? `${formatKst(publishMs)}부터 보임` : `${formatKst(publishMs)} 게시`}
        {Number.isFinite(untilMs) ? ` · 팝업 ${formatKst(untilMs)}까지` : ' · 팝업 없음'}
      </Text>
      {notice.popupText ? (
        <Text style={[adminText.muted, styles.meta]} numberOfLines={2}>
          팝업: {notice.popupText}
        </Text>
      ) : null}
      <Text style={[adminText.muted, styles.meta]} numberOfLines={3}>
        {notice.body}
      </Text>
      {confirming ? (
        <ConfirmBar
          message={`정말 삭제할까요? '${notice.title}' 공지가 앱 공지사항에서 바로 사라지고 되돌릴 수 없어요.`}
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
