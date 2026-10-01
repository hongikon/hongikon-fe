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
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import * as haptics from '../../lib/haptics'
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
  // 접수 완료. 웹에선 Alert 가 아무것도 띄우지 않아(react-native-web) 화면 안에서 알려준다.
  const [submitted, setSubmitted] = useState(false)
  const [validation, setValidation] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) {
      setSubmitted(false)
      setValidation(null)
      setContent('')
      setContact('')
      setSubmitting(false)
      setSubmitError(null)
    }
  }, [visible])

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      setValidation('문의 내용을 입력해 주세요.')
      return
    }
    setValidation(null)

    setSubmitting(true)
    setSubmitError(null)
    try {
      // POST 라 client 가 자동으로 다시 보내지 않는다(중복 접수 방지). 실패하면 사용자가 직접 다시 보낸다.
      await submitFeedback({ content: trimmed, contact: contact.trim() || undefined }, accessToken)
      setSubmitted(true)
      haptics.success()
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
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ModalHeader title="문의하기" onClose={onClose} />
        {submitted ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
            <Text style={styles.successTitle}>문의가 접수됐어요</Text>
            <Text style={styles.successText}>
              운영진이 확인한 뒤{contact.trim() ? ' 적어 주신 이메일로' : ''} 답변드릴게요.
            </Text>
            <TouchableOpacity style={[styles.submitButton, styles.successButton]} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.submitButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
            maxLength={1000}
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
            maxLength={100}
            onChangeText={setContact}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {validation !== null && <Text style={styles.validation}>{validation}</Text>}

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
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitButtonText}>보내기</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
        )}
      </SafeAreaView>
      </SafeAreaProvider>
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
  validation: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger, marginBottom: 12 },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.white },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successTitle: { fontFamily: FONTS.semibold, fontSize: 17, color: COLORS.textPrimary },
  successText: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  successButton: { alignSelf: 'stretch', marginTop: 8 },
})
