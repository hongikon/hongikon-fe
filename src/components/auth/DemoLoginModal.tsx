import { useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { RADIUS, SPACING } from '../../constants/spacing'
import { TYPE } from '../../constants/typography'
import TextField from '../common/TextField'
import Button from '../common/Button'

interface DemoLoginModalProps {
  visible: boolean
  onClose: () => void
  /** 실패하면 보여줄 문구를 담은 Error 를 던진다(AuthContext.loginWithDemo). */
  onSubmit: (username: string, password: string) => Promise<void>
}

/**
 * 앱 심사용 데모 계정 로그인(10-09 — 애플 베타 심사가 아이디·비밀번호 계정을 요구).
 * 웰컴 화면 로고를 5번 누르면 열린다(심사 메모에 적어 둔다). 서버가 기능을 꺼 두면 "꺼져 있어요" 안내만 나온다.
 * 입력값은 서버로 보내기만 하고 기기에 저장하지 않는다.
 */
export default function DemoLoginModal({ visible, onClose, onSubmit }: DemoLoginModalProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (pending) return
    setPassword('')
    setError(null)
    onClose()
  }

  const submit = async () => {
    if (pending || !username.trim() || !password) return
    setPending(true)
    setError(null)
    try {
      await onSubmit(username, password)
      setPassword('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="닫기" accessibilityRole="button" />
        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            심사용 로그인
          </Text>
          <Text style={styles.desc}>앱 심사를 위한 데모 계정 전용이에요.</Text>
          <TextField
            value={username}
            onChangeText={setUsername}
            placeholder="아이디"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            accessibilityLabel="아이디"
          />
          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            accessibilityLabel="비밀번호"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label="로그인"
            onPress={() => void submit()}
            loading={pending}
            disabled={!username.trim() || !password}
          />
          <Button label="닫기" variant="ghost" size="md" onPress={close} disabled={pending} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: SPACING.xl, backgroundColor: COLORS.scrim },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    gap: SPACING.sm,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
  },
  title: { ...TYPE.headline, color: COLORS.textPrimary },
  desc: { ...TYPE.caption, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  error: { ...TYPE.caption, color: COLORS.danger },
})
