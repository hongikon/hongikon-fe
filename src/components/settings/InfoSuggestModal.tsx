import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native'
import SwipeBackModal from '../common/SwipeBackModal'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import RetryableError from '../common/RetryableError'
import Button from '../common/Button'
import Chip from '../common/Chip'
import { RADIUS } from '../../constants/spacing'
import ModalHeader, { ModalPanel } from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import { useInfoSuggestForm } from '../../hooks/settings/useInfoSuggestForm'
import { INTRO, TYPES, type InfoSuggestLocation, type InfoSuggestPrefill } from '../../utils/settings/infoSuggest'
import { PinPicker } from './infoSuggest/FormBits'
import PartnerFields from './infoSuggest/PartnerFields'
import ShowFields from './infoSuggest/ShowFields'
import FacilityFields from './infoSuggest/FacilityFields'
import OtherFields from './infoSuggest/OtherFields'
import ContactField from './infoSuggest/ContactField'

// 지도 화면(useInfoSuggest·useLocationPicker·utils/map/partnerEdit)이 이 경로에서 가져다 쓴다.
export type { InfoSuggestLocation, InfoSuggestPrefill }

interface InfoSuggestModalProps {
  visible: boolean
  onClose: () => void
  /** 지도에서 찍은 위치. 제휴·전시·행사에서 쓴다. */
  location?: InfoSuggestLocation | null
  /** 있으면 "지도에서 위치 찍기" 버튼을 보여준다(누르면 창을 닫고 지도에서 핀을 고른다). */
  onPickOnMap?: () => void
  /** 열 때 미리 채울 값(제휴 시트의 "정보 수정 요청" — 그 가게로 '정보 수정'을 채워 연다, 11-01). */
  prefill?: InfoSuggestPrefill | null
}

/**
 * 앱에 실을 정보를 제보한다. 제휴·혜택, 전시, 행사, 시설 정보, 기타 다섯 가지를 받는다.
 * 별도 API 없이 문의(`POST /feedback`)로 보내고, 종류별 머리말로 관리자 화면에서 구분한다.
 * 로그인 없이도 보낼 수 있다(문의와 같음).
 *
 * 지도 > 제보하기는 "지금 캠퍼스에서 벌어지는 일"을 다른 이용자에게 바로 보여 주는 것이고,
 * 여기는 운영진이 확인해 앱 정보(제휴·전시·행사·편의시설)에 반영할 내용을 받는다.
 * 상태·보내기는 hooks/settings/useInfoSuggestForm, 종류별 칸은 components/settings/infoSuggest/*.
 */
export default function InfoSuggestModal({
  visible,
  onClose,
  location = null,
  onPickOnMap,
  prefill = null,
}: InfoSuggestModalProps) {
  const form = useInfoSuggestForm({ visible, location, prefill, onPickOnMap })
  const { draft, update, attempted, missing, submitting, submitError, submitted, changeType, handleSubmit } = form
  const { type } = draft

  const pin = <PinPicker location={location} canPick={onPickOnMap !== undefined} onPick={form.handlePickOnMap} />

  return (
    <SwipeBackModal visible={visible} onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
          <ContentColumn>
          <ModalHeader title="정보 제보하기" onClose={onClose} />

          <ModalPanel>
          {submitted ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
              <Text style={styles.successTitle}>제보가 접수됐어요</Text>
              <Text style={styles.successText}>
                {type === 'partner'
                  ? '운영진이 제휴 여부와 혜택을 확인한 뒤 지도에 반영해요.'
                  : '운영진이 내용을 확인한 뒤 앱 정보에 반영해요.'}
                {'\n'}확인에는 며칠 걸릴 수 있어요.
              </Text>
              <Button label="확인" onPress={onClose} />
            </View>
          ) : (
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                <View style={styles.typeRow} accessibilityRole="radiogroup" accessibilityLabel="제보 종류">
                  {TYPES.map((item) => (
                    <Chip
                      key={item.value}
                      label={item.label}
                      selected={type === item.value}
                      role="radio"
                      onPress={() => changeType(item.value)}
                    />
                  ))}
                </View>

                {/* 지도 > 제보하기(지금 벌어지는 일)와 헷갈리지 않게 한 줄로 구분해 준다. */}
                <View style={styles.mapNote}>
                  <Ionicons name="map-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.mapNoteText}>
                    지금 캠퍼스에서 열리는 일은 지도 &gt; 제보하기로 알려 주세요. 여기는 앱 정보에 반영할 내용을 받아요.
                  </Text>
                </View>

                <Text style={styles.intro}>{INTRO[type]}</Text>

                {type === 'partner' && <PartnerFields form={form} location={location} pin={pin} />}
                {(type === 'exhibition' || type === 'event') && <ShowFields form={form} pin={pin} />}
                {type === 'facility' && <FacilityFields form={form} />}
                {type === 'other' && <OtherFields form={form} />}

                <ContactField value={draft.contact} onChange={(value) => update('contact', value)} />

                {attempted && missing.length > 0 && (
                  <Text style={styles.validation}>빨간 칸을 채워 주세요.</Text>
                )}

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
                  accessibilityLabel="정보 제보 보내기"
                />
              </ScrollView>
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
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  body: { padding: 20, paddingBottom: 32 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  mapNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.fill,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  mapNoteText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18, color: COLORS.textSecondary },
  intro: { ...TYPE.callout, color: COLORS.textSecondary, marginBottom: 16 },
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
