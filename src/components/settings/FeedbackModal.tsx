import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { useAuth } from '../../contexts/AuthContext'
import { submitFeedback } from '../../apis/feedback'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import RetryableError from '../common/RetryableError'
import ModalHeader from './ModalHeader'

interface FeedbackModalProps {
  visible: boolean
  onClose: () => void
}

export default function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
  const { accessToken } = useAuth()
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  /**
   * 전송 실패 안내. Alert 대신 화면 안에 남기는 이유: 웹의 Alert 는 아무것도 띄우지 않고,
   * 네이티브에서도 닫으면 무엇이 실패했는지 사라진다. 입력한 내용은 그대로 둔다.
   */
  const [submitError, setSubmitError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)

  useEffect(() => {
    if (!visible) {
      setContent('')
      setContact('')
      setSubmitting(false)
      setSubmitError(null)
    }
  }, [visible])

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      Alert.alert('문의 내용을 입력해주세요.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      // POST 라 client 가 자동으로 다시 보내지 않는다(중복 접수 방지). 실패하면 사용자가 직접 다시 보낸다.
      await submitFeedback({ content: trimmed, contact: contact.trim() || undefined }, accessToken)
      Alert.alert('문의가 접수되었습니다', '빠른 시일 내에 확인하겠습니다.', [
        { text: '확인', onPress: onClose },
      ])
    } catch (error) {
      setSubmitError({
        message: getErrorMessage(error, '문의를 보내지 못했습니다. 잠시 후 다시 시도해주세요.'),
        network: isNetworkError(error),
        retryable: isRetryableError(error),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container} edges={['top']}>
        <ModalHeader title="문의하기" onClose={onClose} />
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Text style={styles.label}>내용</Text>
          <TextInput
            style={styles.textArea}
            placeholder="불편한 점이나 제안하고 싶은 내용을 적어주세요"
            placeholderTextColor={COLORS.textPlaceholder}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>답변 받을 이메일 (선택)</Text>
          <TextInput
            style={styles.input}
            placeholder="example@hongik.ac.kr"
            placeholderTextColor={COLORS.textPlaceholder}
            value={contact}
            onChangeText={setContact}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {submitError !== null && (
            <RetryableError
              style={styles.errorBox}
              message={submitError.message}
              isNetworkError={submitError.network}
              onRetry={submitError.retryable ? handleSubmit : undefined}
              retrying={submitting}
            />
          )}

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>{submitting ? '전송 중...' : '보내기'}</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { flex: 1, padding: 20 },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  textArea: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    height: 160,
    marginBottom: 20,
  },
  input: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    height: 44,
    marginBottom: 24,
  },
  errorBox: { marginBottom: 12 },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.white },
})
