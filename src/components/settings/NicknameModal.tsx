import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import * as haptics from '../../lib/haptics'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../common/Toast'
import { clearAppNickname, nicknameErrorMessage, updateAppNickname, type MyProfile } from '../../apis/users'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import {
  APP_NICKNAME_MAX_LENGTH,
  normalizeAppNickname,
  validateAppNickname,
} from '../../utils/nickname'
import RetryableError from '../common/RetryableError'
import ModalHeader from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import Button from '../common/Button'
import TextField, { FieldLabel } from '../common/TextField'

interface NicknameModalProps {
  visible: boolean
  profile: MyProfile
  onClose: () => void
  onSaved: (profile: MyProfile) => void
}

/**
 * 앱 닉네임 설정. 선택 사항이라 지우면 로그인 닉네임 첫 글자만 보이게 가린 이름으로 돌아간다.
 * 입력 규칙은 서버와 같은 `validateAppNickname` 으로 바로 보여 주고, 중복·하루 한도는 서버 응답으로 안내한다.
 */
export default function NicknameModal({ visible, profile, onClose, onSaved }: NicknameModalProps) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState<'save' | 'clear' | null>(null)
  const [submitError, setSubmitError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)
  /** 창을 닫은 뒤 늦게 끝난 요청이 다음에 연 창을 건드리지 못하게 한다(FeedbackModal 과 같은 방식). */
  const requestGenRef = useRef(0)

  useEffect(() => {
    if (visible) {
      setValue(profile.appNickname ?? '')
      setTouched(false)
      setSubmitError(null)
      setSaving(null)
    } else {
      requestGenRef.current += 1
    }
    // 열 때 한 번만 현재 값으로 채운다(profile 이 바뀌어도 입력 중인 값은 그대로 둔다).
  }, [visible])

  const normalized = normalizeAppNickname(value)
  const validation = normalized ? validateAppNickname(normalized) : null
  const unchanged = normalized === (profile.appNickname ?? '')
  const providerLabel = profile.socialType === 'APPLE' ? 'Apple' : '카카오'

  const run = async (kind: 'save' | 'clear') => {
    if (!accessToken) return
    const generation = ++requestGenRef.current
    const isStale = () => generation !== requestGenRef.current
    setSaving(kind)
    setSubmitError(null)
    try {
      const updated =
        kind === 'clear' ? await clearAppNickname(accessToken) : await updateAppNickname(normalized, accessToken)
      if (isStale()) return
      haptics.success()
      toast.show({ message: kind === 'clear' || !updated.appNickname ? '닉네임을 지웠어요' : '닉네임을 바꿨어요' })
      onSaved(updated)
      onClose()
    } catch (error) {
      if (isStale()) return
      setSubmitError({
        message: nicknameErrorMessage(error) ?? getErrorMessage(error, '닉네임을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'),
        network: isNetworkError(error),
        retryable: isRetryableError(error),
      })
    } finally {
      if (!isStale()) setSaving(null)
    }
  }

  const handleSave = () => {
    setTouched(true)
    if (!normalized) {
      // 빈 칸으로 저장하면 지우기와 같다.
      if (profile.appNickname) void run('clear')
      else onClose()
      return
    }
    if (validation || unchanged) return
    void run('save')
  }

  const canSave = !saving && !unchanged && !(normalized && validation)
  const preview = normalized && !validation ? normalized : profile.maskedDefaultName

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ContentColumn>
            <ModalHeader title="닉네임" onClose={onClose} />
            <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <FieldLabel>앱 닉네임 (선택)</FieldLabel>
              <TextField
                style={styles.input}
                placeholder={`${APP_NICKNAME_MAX_LENGTH}자 이내 한글·영문·숫자·_`}
                value={value}
                onChangeText={(text) => {
                  setValue(text)
                  setTouched(true)
                  setSubmitError(null)
                }}
                // 공백·이모지가 섞이면 앞뒤 공백 제거 뒤 길이로 판정한다. 입력 자체는 넉넉히 받는다.
                maxLength={APP_NICKNAME_MAX_LENGTH + 8}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                accessibilityLabel="앱 닉네임"
              />
              {touched && validation !== null ? (
                <Text style={styles.validation}>{validation}</Text>
              ) : (
                <Text style={styles.preview}>
                  제보에 <Text style={styles.previewName}>{preview}</Text>(으)로 표시돼요
                </Text>
              )}

              <Text style={styles.help}>
                설정하지 않으면 {providerLabel} 닉네임이 첫 글자만 보이게 가려져서 표시돼요.
                {'\n'}운영진·학교로 오해할 수 있는 이름이나 다른 사람이 쓰는 닉네임은 쓸 수 없어요.
              </Text>

              {submitError !== null && (
                <RetryableError
                  style={styles.errorBox}
                  message={submitError.message}
                  isNetworkError={submitError.network}
                  onRetry={submitError.retryable ? handleSave : undefined}
                  retrying={saving !== null}
                />
              )}

              <Button
                label="저장"
                onPress={handleSave}
                disabled={!canSave && saving !== 'save'}
                loading={saving === 'save'}
              />

              {profile.appNickname ? (
                <Button
                  variant="ghost"
                  size="md"
                  label={`닉네임 지우기 (${profile.maskedDefaultName}(으)로 표시)`}
                  onPress={() => void run('clear')}
                  disabled={saving !== null && saving !== 'clear'}
                  loading={saving === 'clear'}
                  style={styles.clearButton}
                />
              ) : null}
            </KeyboardAvoidingView>
          </ContentColumn>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { flex: 1, padding: 20 },
  input: { marginBottom: 8 },
  validation: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger, marginBottom: 16 },
  preview: { ...TYPE.callout, color: COLORS.textSecondary, marginBottom: 16 },
  previewName: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  help: {
    ...TYPE.caption,
    lineHeight: 18,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorBox: { marginBottom: 12 },
  clearButton: { marginTop: 8 },
})
