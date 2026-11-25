import { StyleSheet, Text } from 'react-native'
import { Field, FormActions, FormErrors, OptionChips, TextRow } from '../../MapForm'
import { adminText, Card } from '../../ui'
import { MAX_POPUP_DAYS, popupTogglePatch, toKstInput, type NoticeDraft } from '../../utils/notices/noticeDraft'

interface Props {
  draft: NoticeDraft
  update: (patch: Partial<NoticeDraft>) => void
  formErrors: readonly string[]
  saving: boolean
  onCancel: () => void
  onSave: () => void
}

/** 앱 공지 쓰기·수정 폼. 시각은 한국 시간 'YYYY-MM-DD HH:mm' 로 쓴다. */
export function NoticeForm({ draft, update, formErrors, saving, onCancel, onSave }: Props) {
  return (
    <Card style={styles.formCard}>
      <Text style={adminText.strong}>{draft.id !== null ? `수정: ${draft.title || draft.id}` : '새 공지'}</Text>
      <Field label="제목 (필수)">
        <TextRow value={draft.title} onChangeText={(title) => update({ title })} maxLength={100} placeholder="예: 축제 기간 지도 안내" accessibilityLabel="제목" />
      </Field>
      <Field label="본문 (필수)" hint="설정 > 공지사항에서 눌렀을 때 보이는 글입니다. 줄바꿈이 그대로 보입니다.">
        <TextRow value={draft.body} onChangeText={(body) => update({ body })} maxLength={5000} multiline placeholder="공지 내용" accessibilityLabel="본문" />
      </Field>
      <Field label="게시 시각 (필수)" hint={`YYYY-MM-DD HH:mm, 한국 시간 · 지금 ${toKstInput(Date.now())}. 지금보다 앞이면 바로 게시됩니다.`}>
        <TextRow value={draft.publishAt} onChangeText={(publishAt) => update({ publishAt })} maxLength={16} placeholder="2026-11-10 09:00" keyboardType="numbers-and-punctuation" accessibilityLabel="게시 시각" />
      </Field>
      <Field label="앱을 켤 때 팝업">
        <OptionChips
          options={['팝업 없음', '팝업 띄우기']}
          isSelected={(label) => (label === '팝업 띄우기') === draft.popup}
          onToggle={(label) => update(popupTogglePatch(draft, label === '팝업 띄우기'))}
          accessibilityLabel="팝업"
        />
      </Field>
      {draft.popup ? (
        <>
          <Field label="팝업 종료 시각 (필수)" hint={`이 시각 전까지 띄웁니다. 게시 후 ${MAX_POPUP_DAYS}일까지.`}>
            <TextRow value={draft.popupUntil} onChangeText={(popupUntil) => update({ popupUntil })} maxLength={16} placeholder="2026-11-17 09:00" keyboardType="numbers-and-punctuation" accessibilityLabel="팝업 종료 시각" />
          </Field>
          <Field label="팝업 문구 (필수)" hint="카드에 제목 아래로 보이는 짧은 요약입니다. 카드의 '공지 자세히 보기'를 누르면 본문이 열립니다.">
            <TextRow value={draft.popupText} onChangeText={(popupText) => update({ popupText })} maxLength={300} multiline placeholder="예: 축제 3일 동안 부스 위치를 지도에서 볼 수 있어요." accessibilityLabel="팝업 문구" />
          </Field>
        </>
      ) : null}
      <FormErrors errors={formErrors} />
      <FormActions saving={saving} onCancel={onCancel} onSave={onSave} saveLabel={draft.id !== null ? '저장' : '등록'} />
    </Card>
  )
}

const styles = StyleSheet.create({
  formCard: { gap: 14, marginBottom: 16 },
})
