import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { revealLoginName } from '../../api'
import type { AdminLoginName } from '../../types'
import { Button, InlineError } from '../../ui'
import { revealError } from '../../utils/moderationErrors'
import { SOCIAL_LABEL } from '../../utils/userModeration'
import { moderationStyles } from './moderationStyles'

/**
 * "로그인 닉네임 보기" — 누를 때만 서버에서 원문을 받아 이 자리에 보여 준다. 실명일 수 있는 값이라 미리 불러오거나
 * 자동으로 다시 시도하지 않고, "숨기기"를 누르거나 카드가 사라지면 값도 메모리에서 지운다(다시 보려면 다시 누른다).
 */
export function LoginNameReveal({ userId }: { userId: number }) {
  const [value, setValue] = useState<AdminLoginName | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reveal = () => {
    setLoading(true)
    setError(null)
    revealLoginName(userId)
      .then(setValue)
      .catch((err: unknown) => setError(revealError(err)))
      .finally(() => setLoading(false))
  }

  if (value) {
    return (
      <View style={styles.reveal}>
        <Text style={styles.revealText} selectable>
          로그인 닉네임: <Text style={styles.revealValue}>{value.loginNickname}</Text>
          {' '}({SOCIAL_LABEL[value.socialType] ?? value.socialType})
        </Text>
        <View style={moderationStyles.actionsStart}>
          <Button label="숨기기" icon="eye-off-outline" variant="ghost" onPress={() => setValue(null)} small />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.revealRow}>
      <Button label="로그인 닉네임 보기" icon="eye-outline" variant="ghost" onPress={reveal} loading={loading} small />
      {error ? <InlineError message={error} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  reveal: { gap: 2, padding: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.background },
  revealRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  revealText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  revealValue: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },
})
