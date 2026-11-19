import { StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import type { ReportStatus } from '../../types'
import { Button, ConfirmBar } from '../../ui'
import { ACTION_META, actionsFor, type ActionKind } from '../../utils/reportReview'

/** 반려 사유 최대 길이(서버 제한과 같다). */
const NOTE_MAX_LENGTH = 200

interface Props {
  status: ReportStatus
  app: boolean
  confirming: 'reject' | 'delete' | null
  pending: ActionKind | null
  busy: boolean
  note: string
  onChangeNote: (note: string) => void
  onCancelConfirm: () => void
  onConfirmReject: () => void
  onConfirmDelete: () => void
  onActionPress: (kind: ActionKind) => void
}

/**
 * 제보 카드 맨 아래 처리 줄. 평소엔 상태별 처리 버튼, 반려를 누르면 사유 입력, (웹) 삭제를 누르면 한 번 더 묻는 줄로 바뀐다.
 */
export function ReportActionBar({
  status,
  app,
  confirming,
  pending,
  busy,
  note,
  onChangeNote,
  onCancelConfirm,
  onConfirmReject,
  onConfirmDelete,
  onActionPress,
}: Props) {
  if (confirming === 'reject') {
    return (
      <ConfirmBar
        message="반려 사유를 적어주세요. 작성자에게 보일 수 있으니 짧고 정중하게 씁니다."
        confirmLabel="반려"
        danger
        busy={pending === 'reject'}
        onCancel={onCancelConfirm}
        onConfirm={onConfirmReject}
      >
        <TextInput
          value={note}
          onChangeText={onChangeNote}
          placeholder="예: 캠퍼스 현장 정보가 아닌 광고입니다"
          placeholderTextColor={COLORS.textPlaceholder}
          maxLength={NOTE_MAX_LENGTH}
          style={[styles.noteInput, app && styles.noteInputApp]}
          autoFocus
          editable={!busy}
          multiline={app}
          returnKeyType="done"
          submitBehavior={app ? 'blurAndSubmit' : undefined}
          accessibilityLabel="반려 사유"
        />
        <Text style={styles.counter}>
          {note.length}/{NOTE_MAX_LENGTH}
        </Text>
      </ConfirmBar>
    )
  }
  if (confirming === 'delete') {
    return (
      <ConfirmBar
        message="이 제보를 삭제할까요? 목록과 지도에서 사라지며 이 화면에서는 되돌릴 수 없습니다."
        confirmLabel="삭제"
        danger
        busy={pending === 'delete'}
        onCancel={onCancelConfirm}
        onConfirm={onConfirmDelete}
      />
    )
  }
  return (
    <View style={[styles.actions, app && styles.actionsApp]}>
      {actionsFor(status).map((kind) => (
        <Button
          key={kind}
          label={ACTION_META[kind].label}
          onPress={() => onActionPress(kind)}
          loading={pending === kind}
          disabled={busy}
          variant={kind === 'approve' || kind === 'reopen' ? 'primary' : kind === 'delete' ? 'ghost' : 'secondary'}
          small
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  actionsApp: { justifyContent: 'flex-start' },
  noteInput: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteInputApp: { minHeight: 72, fontSize: 15, textAlignVertical: 'top', paddingVertical: 10 },
  counter: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textSecondary, textAlign: 'right' },
})
