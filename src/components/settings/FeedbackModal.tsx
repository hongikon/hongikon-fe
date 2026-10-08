import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { SPACING } from '../../constants/spacing'
import { FONTS, TYPE } from '../../constants/typography'
import * as haptics from '../../lib/haptics'
import { useAuth } from '../../contexts/AuthContext'
import { submitFeedback } from '../../apis/feedback'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import RetryableError from '../common/RetryableError'
import ModalHeader, { ModalPanel } from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import Button from '../common/Button'
import TextField, { FieldLabel } from '../common/TextField'

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

  /** 요청 세대. 창을 닫을 때 올려, 닫은 뒤 늦게 끝난 전송 결과가 다음에 연 빈 창을 건드리지 못하게 한다. */
  const requestGenRef = useRef(0)

  useEffect(() => {
    if (!visible) {
      requestGenRef.current += 1
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

    const generation = ++requestGenRef.current
    const isStale = () => generation !== requestGenRef.current
    setSubmitting(true)
    setSubmitError(null)
    try {
      // POST 라 client 가 자동으로 다시 보내지 않는다(중복 접수 방지). 실패하면 사용자가 직접 다시 보낸다.
      await submitFeedback({ content: trimmed, contact: contact.trim() || undefined }, accessToken)
      if (isStale()) return
      setSubmitted(true)
      haptics.success()
    } catch (error) {
      if (isStale()) return
      setSubmitError({
        message: getErrorMessage(error, '문의를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
        network: isNetworkError(error),
        retryable: isRetryableError(error),
      })
    } finally {
      if (!isStale()) setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
        <ContentColumn>
        <ModalHeader title="문의하기" onClose={onClose} />
        <ModalPanel>
        {submitted ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
            <Text style={styles.successTitle}>문의가 접수됐어요</Text>
            <Text style={styles.successText}>
              운영진이 확인한 뒤{contact.trim() ? ' 적어 주신 이메일로' : ''} 답변드릴게요.
            </Text>
            <Button label="확인" onPress={onClose} style={styles.successButton} />
          </View>
        ) : (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FieldLabel>내용</FieldLabel>
          <TextField
            style={styles.field}
            areaHeight={160}
            placeholder="불편한 점이나 제안하고 싶은 내용을 적어 주세요"
            value={content}
            maxLength={1000}
            onChangeText={setContent}
            multiline
            accessibilityLabel="문의 내용"
          />

          <FieldLabel>답변 받을 이메일 (선택)</FieldLabel>
          <TextField
            style={styles.fieldLast}
            placeholder="example@hongik.ac.kr"
            accessibilityLabel="답변 받을 이메일"
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

          <Button label="보내기" onPress={handleSubmit} loading={submitting} accessibilityLabel="문의 보내기" />
        </KeyboardAvoidingView>
        )}
        </ModalPanel>
        </ContentColumn>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // 회색 바탕 위에 머리 카드와 둥근 흰 본문 판이 뜬다(10-07 설정 탭과 같은 모양).
  container: { flex: 1, backgroundColor: COLORS.background },
  // 글자 왼쪽 끝을 아래 카드들과 같은 28(판 바깥 12 + 안쪽 16)에 맞춘다(10-08).
  body: { flex: 1, paddingHorizontal: SPACING.lg, paddingVertical: 20 },
  field: { marginBottom: 20 },
  fieldLast: { marginBottom: 24 },
  errorBox: { marginBottom: 12 },
  validation: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger, marginBottom: 12 },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successTitle: { ...TYPE.headline, color: COLORS.textPrimary },
  successText: { ...TYPE.callout, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  successButton: { marginTop: 8 },
})
