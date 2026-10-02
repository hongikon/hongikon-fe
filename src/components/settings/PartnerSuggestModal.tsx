import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import * as haptics from '../../lib/haptics'
import { PARTNER_AFFILIATIONS } from '../../constants/partnerAffiliations'
import { useAuth } from '../../contexts/AuthContext'
import { submitFeedback } from '../../apis/feedback'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import RetryableError from '../common/RetryableError'
import Button from '../common/Button'
import Chip from '../common/Chip'
import TextField, { FieldLabel } from '../common/TextField'
import ModalHeader from './ModalHeader'
import { PARTNER_SUGGESTION_PREFIX } from '../../constants/feedback'
import type { PartnerAffiliation } from '../../types'
import ContentColumn from '../common/ContentColumn'

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

  /** 요청 세대. 창을 닫을 때 올려, 닫은 뒤 늦게 끝난 전송 결과가 다음에 연 빈 창을 건드리지 못하게 한다. */
  const requestGenRef = useRef(0)

  useEffect(() => {
    if (!visible) {
      requestGenRef.current += 1
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
    const generation = ++requestGenRef.current
    const isStale = () => generation !== requestGenRef.current
    setSubmitting(true)
    setSubmitError(null)
    try {
      // POST 라 자동으로 다시 보내지 않는다(중복 접수 방지). 실패하면 사용자가 직접 다시 보낸다.
      await submitFeedback({ content: buildContent(), contact: contact.trim() || undefined }, accessToken)
      if (isStale()) return
      setSubmitted(true)
      haptics.success()
    } catch (error) {
      if (isStale()) return
      setSubmitError({
        message: getErrorMessage(error, '제보를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'),
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
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
          <ContentColumn>
          <ModalHeader title="제휴 제보하기" onClose={onClose} />

          {submitted ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
              <Text style={styles.successTitle}>제보가 접수됐어요</Text>
              <Text style={styles.successText}>
                운영진이 제휴 여부와 혜택을 확인한 뒤 지도에 반영해요.{'\n'}확인에는 며칠 걸릴 수 있어요.
              </Text>
              <Button label="확인" onPress={onClose} />
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

                <FieldLabel>가게 이름 *</FieldLabel>
                <TextField
                  style={styles.field}
                  placeholder="예: 발바리네"
                  value={storeName}
                  onChangeText={setStoreName}
                  maxLength={50}
                />

                <FieldLabel>위치 *</FieldLabel>
                {location !== null && (
                  <View style={styles.pickedRow}>
                    <Ionicons name="location" size={15} color={COLORS.primary} />
                    <Text style={styles.pickedText} numberOfLines={1}>
                      {formatLocation(location)}
                    </Text>
                  </View>
                )}
                {onPickOnMap !== undefined && (
                  <Button
                    variant="outline"
                    size="md"
                    icon="pin-outline"
                    label={location ? '지도에서 다시 찍기' : '지도에서 위치 찍기'}
                    onPress={handlePickOnMap}
                    accessibilityLabel={location ? '지도에서 위치 다시 찍기' : '지도에서 위치 찍기'}
                    style={styles.pickButton}
                  />
                )}
                <TextField
                  style={styles.field}
                  placeholder={location ? '상세 주소·층 (선택, 예: 1층 안쪽)' : '주소나 근처 건물 (예: 와우산로 128 1층)'}
                  value={address}
                  onChangeText={setAddress}
                  maxLength={100}
                />

                <FieldLabel>제휴 소속 (알면 선택)</FieldLabel>
                <View style={styles.chipWrap}>
                  {PARTNER_AFFILIATIONS.map((item) => {
                    const active = affiliation === item
                    return (
                      <Chip
                        key={item}
                        label={item}
                        selected={active}
                        onPress={() => setAffiliation(active ? null : item)}
                      />
                    )
                  })}
                </View>

                <FieldLabel>{kind === 'new' ? '혜택' : '무엇이 다른가요?'}</FieldLabel>
                <TextField
                  style={styles.field}
                  areaHeight={100}
                  placeholder={
                    kind === 'new'
                      ? '예: 학생증 제시 시 음료 1개 서비스'
                      : '예: 혜택이 10% 할인에서 음료 서비스로 바뀌었어요'
                  }
                  value={benefit}
                  onChangeText={setBenefit}
                  multiline
                  maxLength={500}
                />

                <FieldLabel>출처 (선택)</FieldLabel>
                <TextField
                  style={styles.field}
                  placeholder="인스타 게시물 링크, 가게 안내문 등"
                  value={source}
                  onChangeText={setSource}
                  autoCapitalize="none"
                  maxLength={200}
                />

                <FieldLabel>답변 받을 이메일 (선택)</FieldLabel>
                <TextField
                  style={styles.field}
                  placeholder="example@hongik.ac.kr"
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

                {/* 보내기 바로 위 한 줄 안내(토스식). 운영진 확인 후 반영된다는 걸 미리 알린다. */}
                <View style={styles.submitNote}>
                  <Ionicons name="information-circle-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={styles.submitNoteText}>
                    운영진이 사실을 확인한 뒤 반영해요. 확인이 어려우면 반영되지 않을 수 있어요.
                  </Text>
                </View>

                <Button
                  label="보내기"
                  onPress={handleSubmit}
                  loading={submitting}
                  accessibilityLabel="제휴 제보 보내기"
                />
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
  body: { padding: 20, paddingBottom: 32 },
  intro: { ...TYPE.callout, color: COLORS.textSecondary, marginBottom: 16 },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kindButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  kindText: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textSecondary },
  kindTextActive: { color: COLORS.white },
  field: { marginBottom: 20 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 20 },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pickedText: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  pickButton: { marginBottom: 8 },
  validation: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger, marginBottom: 12 },
  errorBox: { marginBottom: 12 },
  submitNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 10 },
  submitNoteText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, color: COLORS.textTertiary },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successTitle: { ...TYPE.headline, color: COLORS.textPrimary },
  successText: {
    ...TYPE.callout,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
})
