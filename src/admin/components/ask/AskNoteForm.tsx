import { StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import type { AdminAskNote } from '../../types'
import { Button, InlineError } from '../../ui'
import { useAskNoteForm } from '../../hooks/ask/useAskNoteForm'

/**
 * 운영진 확인 안내 쓰기. 물어보기가 비슷한 질문에 답할 때 이 글을 근거로 함께 읽는다.
 * 학생 개인 정보(휴대전화·주민번호·학번)는 서버가 거절한다.
 */
export function AskNoteForm({
  initialQuestion = '',
  askRef = null,
  note = null,
  onSaved,
  onCancel,
}: {
  initialQuestion?: string
  askRef?: string | null
  note?: AdminAskNote | null
  onSaved: (note: AdminAskNote) => void
  onCancel: () => void
}) {
  const { question, setQuestion, answer, setAnswer, pending, error, save } = useAskNoteForm({ initialQuestion, askRef, note, onSaved })

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{note ? '안내 고치기' : '운영진 확인 안내로 등록'}</Text>
      <Text style={styles.meta}>
        비슷한 질문이 오면 물어보기가 이 답을 근거로 써요. 여러 학생에게 똑같이 맞는 답만 적고, 학생 이름·학번·연락처 같은 개인 정보는 빼 주세요.
      </Text>
      <TextInput
        value={question}
        onChangeText={setQuestion}
        placeholder="질문 (예: T동 강의실 마이크는 어디서 빌려요?)"
        placeholderTextColor={COLORS.textPlaceholder}
        maxLength={200}
        style={styles.input}
        accessibilityLabel="안내 질문"
      />
      <TextInput
        value={answer}
        onChangeText={setAnswer}
        placeholder="답 (확인한 사실만, 필요하면 담당 부서·전화)"
        placeholderTextColor={COLORS.textPlaceholder}
        maxLength={2000}
        multiline
        style={[styles.input, styles.inputTall]}
        accessibilityLabel="안내 답"
      />
      {error ? <InlineError message={error} /> : null}
      <View style={styles.actions}>
        <Button label="취소" onPress={onCancel} small />
        <Button label="저장" icon="checkmark" variant="primary" onPress={save} loading={pending} small />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  meta: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  form: { gap: 8 },
  formTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  inputTall: { minHeight: 110, textAlignVertical: 'top' },
})
