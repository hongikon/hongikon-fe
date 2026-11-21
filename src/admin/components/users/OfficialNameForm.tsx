import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { setOfficialName } from '../../api'
import type { AdminUser } from '../../types'
import { ConfirmBar, InlineError, useAdminHost } from '../../ui'
import { officialError } from '../../utils/moderationErrors'
import { moderationStyles } from './moderationStyles'

/**
 * 공식 이름 입력·지정 막대. 회원 카드와 문의 탭의 '공식 계정 신청' 글에서 함께 쓴다. 신청 글에서는 신청서의 단체 이름을
 * initialName 으로 미리 채워, 확인만 하고 누르면 되게 한다. 서버는 공식 계정 신청을 보낸 회원에게만 붙이고(그 외 400),
 * 붙이면 그 회원의 열린 신청을 처리 완료로 닫는다.
 */
export function OfficialNameForm({
  userId,
  initialName = '',
  onDone,
  onCancel,
}: {
  userId: number
  initialName?: string
  onDone: (user: AdminUser) => void
  onCancel: () => void
}) {
  const app = useAdminHost() === 'app'
  const [draft, setDraft] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const name = draft.trim()
    if (name.length < 2) {
      setError('공식 이름을 2자 이상 입력해주세요.')
      return
    }
    setBusy(true)
    setError(null)
    setOfficialName(userId, name)
      .then(onDone)
      .catch((err: unknown) => setError(officialError(err, '공식 계정으로 지정하지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setBusy(false))
  }

  return (
    <View style={styles.officialForm}>
      <ConfirmBar
        message="이 계정에 붙일 공식 이름(2~30자)을 확인해 주세요. 앱 닉네임 대신 이 이름과 공식 배지가 제보·댓글에 보입니다. 단체를 확인한 뒤에만 지정하세요."
        confirmLabel="지정"
        busy={busy}
        onCancel={onCancel}
        onConfirm={submit}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="예: 경영대학 학생회"
          placeholderTextColor={COLORS.textPlaceholder}
          maxLength={30}
          style={[moderationStyles.input, app && moderationStyles.inputApp]}
          autoFocus
          accessibilityLabel="공식 이름"
          editable={!busy}
        />
      </ConfirmBar>
      {error ? <InlineError message={error} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  officialForm: { gap: 8 },
})
