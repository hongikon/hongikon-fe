import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import * as haptics from '../../lib/haptics'
import { useAuth } from '../../contexts/AuthContext'
import { submitFeedback } from '../../apis/feedback'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import { OFFICIAL_REQUEST_PREFIX } from '../../constants/feedback'
import RetryableError from '../common/RetryableError'
import ModalHeader from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import Button from '../common/Button'
import OfficialBadge from '../common/OfficialBadge'
import TextField, { FieldLabel } from '../common/TextField'

interface OfficialRequestModalProps {
  visible: boolean
  onClose: () => void
  /** 신청하는 계정의 회원 번호·지금 이름. 운영진이 이 값으로 계정을 찾아 공식 이름을 붙인다. */
  memberNumber: string | null
  currentName: string | null
}

/**
 * 학생회·동아리 등 단체의 "공식 계정" 신청. 별도 API 없이 문의(`POST /feedback`)로 보내고 머리말로 구분한다
 * (관리 화면 문의 탭에 '공식 계정 신청' 배지). 운영진이 단체를 확인하면 관리 > 회원에서 공식 이름을 붙인다.
 * 계정에 붙이는 것이라 로그인한 사람만 연다(설정의 계정 섹션).
 */
export default function OfficialRequestModal({ visible, onClose, memberNumber, currentName }: OfficialRequestModalProps) {
  const { accessToken } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [proof, setProof] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [validation, setValidation] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<{ message: string; network: boolean; retryable: boolean } | null>(null)
  /** 창을 닫으면 올려, 늦게 끝난 전송 결과가 다음에 연 빈 창을 건드리지 못하게 한다. */
  const requestGenRef = useRef(0)

  useEffect(() => {
    if (!visible) {
      requestGenRef.current += 1
      setOrgName('')
      setProof('')
      setContact('')
      setSubmitting(false)
      setSubmitted(false)
      setValidation(null)
      setSubmitError(null)
    }
  }, [visible])

  const handleSubmit = async () => {
    if (submitting) return
    const name = orgName.trim()
    const reach = contact.trim()
    if (name.length < 2) {
      setValidation('단체 이름을 적어 주세요. 예: 경영대학 학생회')
      return
    }
    if (!reach) {
      setValidation('확인 연락을 받을 이메일이나 전화번호를 적어 주세요.')
      return
    }
    setValidation(null)
    const content = [
      `${OFFICIAL_REQUEST_PREFIX} ${name}`,
      memberNumber ? `회원 번호: ${memberNumber}` : null,
      currentName ? `지금 이름: ${currentName}` : null,
      proof.trim() ? `확인 자료: ${proof.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const generation = ++requestGenRef.current
    const isStale = () => generation !== requestGenRef.current
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitFeedback({ content, contact: reach }, accessToken)
      if (isStale()) return
      setSubmitted(true)
      haptics.success()
    } catch (error) {
      if (isStale()) return
      setSubmitError({
        message: getErrorMessage(error, '신청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'),
        network: isNetworkError(error),
        retryable: isRetryableError(error),
      })
    } finally {
      if (!isStale()) setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ContentColumn>
            <ModalHeader title="공식 계정 신청" onClose={onClose} />
            {submitted ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
                <Text style={styles.successTitle}>신청이 접수됐어요</Text>
                <Text style={styles.successText}>
                  운영진이 단체를 확인한 뒤 적어 주신 연락처로 알려 드리고, 이 계정에 공식 이름과 배지를 붙여 드려요.
                </Text>
                <Button label="확인" onPress={onClose} style={styles.successButton} />
              </View>
            ) : (
              <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                  <View style={styles.intro}>
                    <View style={styles.preview}>
                      <Text style={styles.previewName}>경영대학 학생회</Text>
                      <OfficialBadge size="medium" />
                    </View>
                    <Text style={styles.introText}>
                      학생회·동아리 같은 단체 계정이면 운영진이 확인한 뒤 이 계정의 이름을 단체 이름으로 바꾸고 공식 배지를 붙여
                      드려요. 제보와 댓글에 배지가 함께 보여 학생들이 믿고 볼 수 있어요.
                    </Text>
                  </View>

                  <FieldLabel>단체 이름 *</FieldLabel>
                  <TextField
                    style={styles.field}
                    placeholder="예: 경영대학 학생회"
                    value={orgName}
                    onChangeText={setOrgName}
                    maxLength={30}
                    accessibilityLabel="단체 이름"
                  />

                  <FieldLabel>확인 자료 (선택)</FieldLabel>
                  <TextField
                    style={styles.field}
                    placeholder="단체 인스타그램·홈페이지 주소 등"
                    value={proof}
                    onChangeText={setProof}
                    maxLength={200}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="확인 자료"
                  />

                  <FieldLabel>연락처 *</FieldLabel>
                  <TextField
                    style={styles.fieldLast}
                    placeholder="확인 연락을 받을 이메일 또는 전화번호"
                    value={contact}
                    onChangeText={setContact}
                    maxLength={100}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="연락처"
                  />

                  {memberNumber ? <Text style={styles.note}>신청 계정: 회원 번호 {memberNumber}</Text> : null}
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
                  <Button label="신청하기" onPress={handleSubmit} loading={submitting} />
                </ScrollView>
              </KeyboardAvoidingView>
            )}
          </ContentColumn>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  body: { padding: 20 },
  intro: { gap: 10, marginBottom: 22, padding: 14, borderRadius: 12, backgroundColor: COLORS.fill },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewName: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  introText: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, color: COLORS.textSecondary },
  field: { marginBottom: 20 },
  fieldLast: { marginBottom: 12 },
  note: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginBottom: 16 },
  errorBox: { marginBottom: 12 },
  validation: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger, marginBottom: 12 },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successTitle: { ...TYPE.headline, color: COLORS.textPrimary },
  successText: { ...TYPE.callout, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  successButton: { marginTop: 8 },
})
