import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { PARTNER_AFFILIATIONS } from '../../constants/partnerAffiliations'
import { useAuth } from '../../contexts/AuthContext'
import { submitFeedback } from '../../apis/feedback'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import RetryableError from '../common/RetryableError'
import { chipStyles } from '../map/chipStyles'
import ModalHeader from './ModalHeader'
import { PARTNER_SUGGESTION_PREFIX } from '../../constants/feedback'
import type { PartnerAffiliation } from '../../types'

const MAX_CONTENT_LENGTH = 1000 // 서버 FeedbackCreateRequest.content 상한

type Kind = 'new' | 'fix'

/** 지도에서 핀으로 찍은 위치. 좌표는 제보 내용에 그대로 담아 운영진이 바로 지도에 넣을 수 있게 한다. */
export interface PartnerSuggestLocation {
  lat: number
  lng: number
  /** 핀 근처 건물 이름(없을 수 있음) */
  buildingName: string | null
}

interface PartnerSuggestModalProps {
  visible: boolean
  onClose: () => void
  /** 지도에서 찍은 위치. 있으면 위치 칸이 채워지고 주소 입력은 선택이 된다. */
  location?: PartnerSuggestLocation | null
  /** 있으면 "지도에서 위치 찍기" 버튼을 보여준다(누르면 창을 닫고 지도에서 핀을 고른다). */
  onPickOnMap?: () => void
}

interface Draft {
  kind: Kind
  storeName: string
  address: string
  affiliation: PartnerAffiliation | null
  benefit: string
  source: string
  contact: string
}

/**
 * "지도에서 위치 찍기"로 창을 닫았다가(설정 → 지도) 다시 열 때 입력해 둔 내용을 되살리기 위한 임시 보관.
 * 설정 화면과 지도 화면이 각자 이 창을 띄우므로 컴포넌트 밖에 둔다.
 */
let savedDraft: Draft | null = null

function formatLocation(location: PartnerSuggestLocation): string {
  const coord = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
  return location.buildingName ? `${location.buildingName} 근처 (${coord})` : coord
}

/**
 * 새 제휴 업체를 알려 주거나 기존 제휴 정보(혜택·위치)가 틀렸을 때 제보한다.
 * 별도 API 없이 문의(`POST /feedback`)로 보내고, 머리말로 관리자 화면에서 구분한다.
 * 로그인 없이도 보낼 수 있다(문의와 같음).
 */
export default function PartnerSuggestModal({
  visible,
  onClose,
  location = null,
  onPickOnMap,
}: PartnerSuggestModalProps) {
  const { accessToken } = useAuth()
  const [kind, setKind] = useState<Kind>('new')
  const [storeName, setStoreName] = useState('')
  const [address, setAddress] = useState('')
  const [affiliation, setAffiliation] = useState<PartnerAffiliation | null>(null)
  const [benefit, setBenefit] = useState('')
  const [source, setSource] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [validation, setValidation] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)
  // 접수 완료. 웹에선 Alert 가 뜨지 않아 화면 안에서 알려준다.
  const [submitted, setSubmitted] = useState(false)

  // 지도에서 위치를 찍고 돌아왔으면 입력해 두었던 내용을 되살린다.
  useEffect(() => {
    if (visible && savedDraft) {
      const draft = savedDraft
      savedDraft = null
      setKind(draft.kind)
      setStoreName(draft.storeName)
      setAddress(draft.address)
      setAffiliation(draft.affiliation)
      setBenefit(draft.benefit)
      setSource(draft.source)
      setContact(draft.contact)
    }
  }, [visible])

  const handlePickOnMap = () => {
    savedDraft = { kind, storeName, address, affiliation, benefit, source, contact }
    onPickOnMap?.()
  }

  useEffect(() => {
    if (!visible) {
      setKind('new')
      setStoreName('')
      setAddress('')
      setAffiliation(null)
      setBenefit('')
      setSource('')
      setContact('')
      setSubmitting(false)
      setValidation(null)
      setSubmitError(null)
      setSubmitted(false)
    }
  }, [visible])

  const buildContent = (): string => {
    const lines = [
      `${PARTNER_SUGGESTION_PREFIX} ${kind === 'new' ? '새 제휴 업체' : '제휴 정보 수정'}`,
      `가게: ${storeName.trim()}`,
      address.trim() ? `위치: ${address.trim()}` : null,
      location ? `좌표: ${location.lat.toFixed(7)}, ${location.lng.toFixed(7)}${location.buildingName ? ` (${location.buildingName} 근처)` : ''}` : null,
      affiliation ? `소속: ${affiliation}` : null,
      benefit.trim() ? `${kind === 'new' ? '혜택' : '달라진 점'}: ${benefit.trim()}` : null,
      source.trim() ? `출처: ${source.trim()}` : null,
    ].filter((line): line is string => line !== null)
    return lines.join('\n').slice(0, MAX_CONTENT_LENGTH)
  }

  const handleSubmit = async () => {
    if (!storeName.trim() || (!address.trim() && !location)) {
      setValidation('가게 이름과 위치(주소 또는 지도에서 찍기)는 꼭 알려 주세요.')
      return
    }
    setValidation(null)
    setSubmitting(true)
    setSubmitError(null)
    try {
      // POST 라 자동으로 다시 보내지 않는다(중복 접수 방지). 실패하면 사용자가 직접 다시 보낸다.
      await submitFeedback({ content: buildContent(), contact: contact.trim() || undefined }, accessToken)
      setSubmitted(true)
    } catch (error) {
      setSubmitError({
        message: getErrorMessage(error, '제보를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'),
        network: isNetworkError(error),
        retryable: isRetryableError(error),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ModalHeader title="제휴 제보하기" onClose={onClose} />

          {submitted ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
              <Text style={styles.successTitle}>제보가 접수됐어요</Text>
              <Text style={styles.successText}>
                운영진이 제휴 여부와 혜택을 확인한 뒤 지도에 반영해요.{'\n'}확인에는 며칠 걸릴 수 있어요.
              </Text>
              <TouchableOpacity style={styles.submitButton} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.submitButtonText}>확인</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                <Text style={styles.intro}>
                  학생 할인·서비스를 주는 가게를 알려 주시거나, 앱에 나온 제휴 정보가 다르면 알려 주세요.
                </Text>

                <View style={styles.kindRow}>
                  {(
                    [
                      ['new', '새 제휴 업체'],
                      ['fix', '정보가 달라요'],
                    ] as const
                  ).map(([value, label]) => {
                    const active = kind === value
                    return (
                      <TouchableOpacity
                        key={value}
                        style={[styles.kindButton, active && styles.kindButtonActive]}
                        onPress={() => setKind(value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.kindText, active && styles.kindTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <Text style={styles.label}>가게 이름 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="예: 발바리네"
                  placeholderTextColor={COLORS.textPlaceholder}
                  value={storeName}
                  onChangeText={setStoreName}
                  maxLength={50}
                />

                <Text style={styles.label}>위치 *</Text>
                {location !== null && (
                  <View style={styles.pickedRow}>
                    <Ionicons name="location" size={15} color={COLORS.primary} />
                    <Text style={styles.pickedText} numberOfLines={1}>
                      {formatLocation(location)}
                    </Text>
                  </View>
                )}
                {onPickOnMap !== undefined && (
                  <TouchableOpacity
                    style={styles.pickButton}
                    onPress={handlePickOnMap}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={location ? '지도에서 위치 다시 찍기' : '지도에서 위치 찍기'}
                  >
                    <Ionicons name="pin-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.pickButtonText}>
                      {location ? '지도에서 다시 찍기' : '지도에서 위치 찍기'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TextInput
                  style={styles.input}
                  placeholder={location ? '상세 주소·층 (선택, 예: 1층 안쪽)' : '주소나 근처 건물 (예: 와우산로 128 1층)'}
                  placeholderTextColor={COLORS.textPlaceholder}
                  value={address}
                  onChangeText={setAddress}
                  maxLength={100}
                />

                <Text style={styles.label}>제휴 소속 (알면 선택)</Text>
                <View style={styles.chipWrap}>
                  {PARTNER_AFFILIATIONS.map((item) => {
                    const active = affiliation === item
                    return (
                      <TouchableOpacity
                        key={item}
                        activeOpacity={0.75}
                        onPress={() => setAffiliation(active ? null : item)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[chipStyles.chip, active && styles.chipActive]}
                      >
                        <Text style={[chipStyles.label, active && chipStyles.labelActive]}>{item}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <Text style={styles.label}>{kind === 'new' ? '혜택' : '무엇이 다른가요?'}</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder={
                    kind === 'new'
                      ? '예: 학생증 제시 시 음료 1개 서비스'
                      : '예: 혜택이 10% 할인에서 음료 서비스로 바뀌었어요'
                  }
                  placeholderTextColor={COLORS.textPlaceholder}
                  value={benefit}
                  onChangeText={setBenefit}
                  multiline
                  textAlignVertical="top"
                  maxLength={500}
                />

                <Text style={styles.label}>출처 (선택)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="인스타 게시물 링크, 가게 안내문 등"
                  placeholderTextColor={COLORS.textPlaceholder}
                  value={source}
                  onChangeText={setSource}
                  autoCapitalize="none"
                  maxLength={200}
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
                  maxLength={100}
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
                  accessibilityRole="button"
                  accessibilityLabel="제휴 제보 보내기"
                >
                  {submitting ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.submitButtonText}>보내기</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  body: { padding: 20, paddingBottom: 32 },
  intro: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kindButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  kindText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textPrimary },
  kindTextActive: { color: COLORS.white },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    height: 44,
    marginBottom: 20,
  },
  textArea: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    height: 100,
    marginBottom: 20,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 20 },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF0FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pickedText: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 8,
  },
  pickButtonText: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.primary },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  validation: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger, marginBottom: 12 },
  errorBox: { marginBottom: 12 },
  submitButton: {
    alignSelf: 'stretch',
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
  successText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
})
