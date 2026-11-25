import {

  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import SwipeBackModal from '../common/SwipeBackModal'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { SPACING } from '../../constants/spacing'
import { FONTS, TYPE } from '../../constants/typography'
import { isNetworkError } from '../../apis/client'
import RetryableError from '../common/RetryableError'
import ModalHeader, { ModalPanel } from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import Button from '../common/Button'
import TextField, { FieldLabel } from '../common/TextField'
import { useFeedbackModal } from '../../hooks/settings/useFeedbackModal'

export interface FeedbackModalProps {
  visible: boolean
  onClose: () => void
}

export default function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
  const { content, setContent, contact, setContact, submitting, submitError, submitted, validation, handleSubmit } = useFeedbackModal({ visible })

  return (
    <SwipeBackModal visible={visible} onRequestClose={onClose}>
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
    </SwipeBackModal>
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
