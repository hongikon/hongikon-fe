import { useEffect, useMemo, useRef, useState } from 'react'
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
import { FACILITY_KINDS } from '../../constants/facilityKinds'
import { useMapData } from '../../lib/mapData'
import { useAuth } from '../../contexts/AuthContext'
import { submitFeedback } from '../../apis/feedback'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import RetryableError from '../common/RetryableError'
import Button from '../common/Button'
import Chip from '../common/Chip'
import TextField, { FieldLabel } from '../common/TextField'
import ModalHeader from './ModalHeader'
import { INFO_SUGGESTION_PREFIXES, type InfoSuggestType } from '../../constants/feedback'
import type { PartnerAffiliation } from '../../types'
import ContentColumn from '../common/ContentColumn'

const MAX_CONTENT_LENGTH = 1000 // 서버 FeedbackCreateRequest.content 상한

/** 위쪽 종류 칩. 배열 순서가 칩 순서다. */
const TYPES: readonly { value: InfoSuggestType; label: string }[] = [
  { value: 'partner', label: '제휴·혜택' },
  { value: 'exhibition', label: '전시' },
  { value: 'event', label: '행사' },
  { value: 'facility', label: '시설 정보' },
  { value: 'other', label: '기타' },
]

const INTRO: Record<InfoSuggestType, string> = {
  partner: '학생 할인·서비스를 주는 가게를 알려 주시거나, 앱에 나온 제휴 정보가 다르면 알려 주세요.',
  exhibition: '졸업전·과 전시처럼 앞으로 열리거나 열리고 있는 전시를 알려 주세요.',
  event: '축제·설명회처럼 해마다 열리거나 열릴 예정인 행사를 알려 주세요.',
  facility: '편의시설의 위치·층·운영시간이 틀렸거나, 새로 생긴 시설이 있으면 알려 주세요.',
  other: '앱에 실렸으면 하는 정보나 고쳐야 할 내용을 자유롭게 알려 주세요.',
}

/**
 * 시설 종류 칩. 전시·행사는 위 종류 칩으로 따로 받으므로 빼고, 목록에 없는 시설용 칸을 둔다.
 * 흡연구역은 지도에서 숨긴 동안(MapFilterChips) 여기서도 보이지 않는다(10-05 요청).
 */
const FACILITY_KIND_OPTIONS: readonly string[] = [
  ...FACILITY_KINDS.filter((meta) => meta.key !== '행사·전시' && meta.key !== '흡연구역').map((meta) => meta.key),
  '그 밖의 시설',
]

type Kind = 'new' | 'fix'

/** 지도에서 핀으로 찍은 위치. 좌표는 제보 내용에 그대로 담아 운영진이 바로 지도에 넣을 수 있게 한다. */
export interface InfoSuggestLocation {
  lat: number
  lng: number
  /** 핀 근처 건물 이름(없을 수 있음) */
  buildingName: string | null
}

interface InfoSuggestModalProps {
  visible: boolean
  onClose: () => void
  /** 지도에서 찍은 위치. 제휴·전시·행사에서 쓴다. */
  location?: InfoSuggestLocation | null
  /** 있으면 "지도에서 위치 찍기" 버튼을 보여준다(누르면 창을 닫고 지도에서 핀을 고른다). */
  onPickOnMap?: () => void
}

interface Draft {
  type: InfoSuggestType
  kind: Kind
  name: string
  address: string
  affiliation: PartnerAffiliation | null
  detail: string
  source: string
  period: string
  building: string | null
  floor: string
  facilityKind: string | null
  contact: string
  /** 행사·전시가 온라인으로만 열린다(장소 칸 대신). */
  online: boolean
}

const EMPTY_DRAFT: Draft = {
  type: 'partner',
  kind: 'new',
  name: '',
  address: '',
  affiliation: null,
  detail: '',
  source: '',
  period: '',
  building: null,
  floor: '',
  facilityKind: null,
  contact: '',
  online: false,
}

/** 비어 있으면 안 되는 칸. 보내기를 눌렀을 때 빨간 테두리와 안내가 붙는다. */
type RequiredField = 'name' | 'location' | 'place' | 'period' | 'facilityKind' | 'building' | 'detail'

const REQUIRED_HINT: Record<RequiredField, string> = {
  name: '이름을 알려 주세요.',
  location: '주소를 적거나 지도에서 위치를 찍어 주세요.',
  place: '건물을 고르거나, 장소를 적거나, 지도에서 위치를 찍어 주세요. 온라인 행사면 온라인을 골라 주세요.',
  period: '언제 열리는지 알려 주세요.',
  facilityKind: '어떤 시설인지 골라 주세요.',
  building: '건물을 골라 주세요.',
  detail: '내용을 적어 주세요.',
}

/**
 * "지도에서 위치 찍기"로 창을 닫았다가(설정 → 지도) 다시 열 때 입력해 둔 내용을 되살리기 위한 임시 보관.
 * 설정 화면과 지도 화면이 각자 이 창을 띄우므로 컴포넌트 밖에 둔다.
 */
let savedDraft: Draft | null = null

function formatLocation(location: InfoSuggestLocation): string {
  const coord = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
  return location.buildingName ? `${location.buildingName} 근처 (${coord})` : coord
}

function formatCoord(location: InfoSuggestLocation): string {
  return `${location.lat.toFixed(7)}, ${location.lng.toFixed(7)}${location.buildingName ? ` (${location.buildingName} 근처)` : ''}`
}

function missingFields(draft: Draft, location: InfoSuggestLocation | null): RequiredField[] {
  const missing: RequiredField[] = []
  const blank = (value: string) => value.trim().length === 0
  switch (draft.type) {
    case 'partner':
      if (blank(draft.name)) missing.push('name')
      if (blank(draft.address) && !location) missing.push('location')
      break
    case 'exhibition':
    case 'event':
      if (blank(draft.name)) missing.push('name')
      // 장소가 없으면 운영진이 지도에 올릴 수 없다(장소 없는 행사 제보가 들어왔다, 10-05). 건물·주소·핀 중 하나,
      // 온라인 행사면 '온라인'을 고르면 된다.
      if (!draft.online && !draft.building && blank(draft.address) && !location) missing.push('place')
      if (blank(draft.period)) missing.push('period')
      break
    case 'facility':
      if (!draft.facilityKind) missing.push('facilityKind')
      if (!draft.building) missing.push('building')
      if (blank(draft.detail)) missing.push('detail')
      break
    case 'other':
      if (blank(draft.detail)) missing.push('detail')
      break
  }
  return missing
}

/** 관리자가 그대로 읽을 수 있는 줄글. 맨 앞 머리말로 관리자 화면이 종류를 가른다. */
function buildContent(draft: Draft, location: InfoSuggestLocation | null): string {
  const t = (value: string) => value.trim()
  const line = (label: string, value: string | null | undefined) => (value && value.trim() ? `${label}: ${value.trim()}` : null)
  const prefix = INFO_SUGGESTION_PREFIXES[draft.type]
  let lines: (string | null)[]
  switch (draft.type) {
    case 'partner':
      // 정보 제보로 넓히기 전과 같은 모양(관리자가 익숙한 형식)
      lines = [
        `${prefix} ${draft.kind === 'new' ? '새 제휴 업체' : '제휴 정보 수정'}`,
        `가게: ${t(draft.name)}`,
        line('위치', draft.address),
        location ? `좌표: ${formatCoord(location)}` : null,
        line('소속', draft.affiliation),
        line(draft.kind === 'new' ? '혜택' : '달라진 점', draft.detail),
        line('출처', draft.source),
      ]
      break
    case 'exhibition':
    case 'event': {
      const place = draft.online
        ? ['온라인', t(draft.address)].filter(Boolean).join(' · ')
        : [draft.building, t(draft.address)].filter(Boolean).join(' · ')
      lines = [
        prefix,
        line('이름', draft.name),
        line('장소', place),
        location && !draft.online ? `좌표: ${formatCoord(location)}` : null,
        line('기간', draft.period),
        line('내용', draft.detail),
      ]
      break
    }
    case 'facility':
      lines = [
        `${prefix} ${draft.kind === 'new' ? '새 시설' : '정보 수정'}`,
        line('시설', draft.facilityKind),
        line('건물', draft.building),
        line('층·호수', draft.floor),
        line(draft.kind === 'new' ? '새 정보' : '틀린 점', draft.detail),
      ]
      break
    case 'other':
      lines = [prefix, line('내용', draft.detail)]
      break
  }
  return lines
    .filter((value): value is string => value !== null)
    .join('\n')
    .slice(0, MAX_CONTENT_LENGTH)
}

/** 건물 고르기. 이름 일부로 거르고 가로로 넘기는 칩에서 고른다. 다시 누르면 고른 걸 푼다. */
function BuildingPicker({
  value,
  onChange,
  invalid,
}: {
  value: string | null
  onChange: (name: string | null) => void
  invalid?: boolean
}) {
  const [query, setQuery] = useState('')
  // 건물 목록은 지도 데이터에서 온다. 아직 못 받았으면 칩이 비고, 검색창 아래 안내가 뜬다.
  const { buildings, data } = useMapData()
  const names = useMemo(() => {
    const q = query.replace(/\s/g, '').toLowerCase()
    const all = buildings.map((building) => building.name)
    const filtered = q ? all.filter((name) => name.replace(/\s/g, '').toLowerCase().includes(q)) : all
    // 고른 건물은 걸러져도 맨 앞에 남겨 무엇을 골랐는지 보이게 한다.
    return value ? [value, ...filtered.filter((name) => name !== value)] : filtered
  }, [buildings, query, value])

  return (
    <View style={styles.pickerBlock}>
      <TextField
        style={[styles.searchField, invalid && styles.fieldInvalid]}
        placeholder="건물 이름 검색 (예: 홍문관, R동)"
        value={query}
        onChangeText={setQuery}
        maxLength={30}
        accessibilityLabel="건물 이름 검색"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.buildingRow}
      >
        {names.length === 0 ? (
          <Text style={styles.emptyText}>{data ? '맞는 건물이 없어요' : '건물 목록을 불러오는 중이에요'}</Text>
        ) : (
          names.map((name) => {
            const active = value === name
            return (
              <Chip
                key={name}
                label={name}
                selected={active}
                role="radio"
                onPress={() => onChange(active ? null : name)}
              />
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

function Hint({ text }: { text: string }) {
  return (
    <Text style={styles.hint} accessibilityLiveRegion="polite">
      {text}
    </Text>
  )
}

/**
 * 앱에 실을 정보를 제보한다. 제휴·혜택, 전시, 행사, 시설 정보, 기타 다섯 가지를 받는다.
 * 별도 API 없이 문의(`POST /feedback`)로 보내고, 종류별 머리말로 관리자 화면에서 구분한다.
 * 로그인 없이도 보낼 수 있다(문의와 같음).
 *
 * 지도 > 제보하기는 "지금 캠퍼스에서 벌어지는 일"을 다른 이용자에게 바로 보여 주는 것이고,
 * 여기는 운영진이 확인해 앱 정보(제휴·전시·행사·편의시설)에 반영할 내용을 받는다.
 */
export default function InfoSuggestModal({
  visible,
  onClose,
  location = null,
  onPickOnMap,
}: InfoSuggestModalProps) {
  const { accessToken } = useAuth()
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)
  // 접수 완료. 웹에선 Alert 가 뜨지 않아 화면 안에서 알려준다.
  const [submitted, setSubmitted] = useState(false)

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  // 지도에서 위치를 찍고 돌아왔으면 입력해 두었던 내용을 되살린다(종류와 모든 칸).
  useEffect(() => {
    if (visible && savedDraft) {
      const restored = savedDraft
      savedDraft = null
      setDraft(restored)
    }
  }, [visible])

  const handlePickOnMap = () => {
    savedDraft = draft
    onPickOnMap?.()
  }

  /** 요청 세대. 창을 닫을 때 올려, 닫은 뒤 늦게 끝난 전송 결과가 다음에 연 빈 창을 건드리지 못하게 한다. */
  const requestGenRef = useRef(0)

  useEffect(() => {
    if (!visible) {
      requestGenRef.current += 1
      setDraft(EMPTY_DRAFT)
      setAttempted(false)
      setSubmitting(false)
      setSubmitError(null)
      setSubmitted(false)
    }
  }, [visible])

  const missing = missingFields(draft, location)
  const invalid = (field: RequiredField) => attempted && missing.includes(field)

  const changeType = (type: InfoSuggestType) => {
    if (type === draft.type) return
    // 이름·내용·연락처는 옮겨 가도 뜻이 통해 남기고, 종류마다 다른 칸만 비운다.
    setDraft((prev) => ({ ...prev, type, kind: 'new', affiliation: null, source: '', period: '', facilityKind: null }))
    setAttempted(false)
  }

  const handleSubmit = async () => {
    if (missing.length > 0) {
      setAttempted(true)
      haptics.warning()
      return
    }
    const generation = ++requestGenRef.current
    const isStale = () => generation !== requestGenRef.current
    setSubmitting(true)
    setSubmitError(null)
    try {
      // POST 라 자동으로 다시 보내지 않는다(중복 접수 방지). 실패하면 사용자가 직접 다시 보낸다.
      await submitFeedback(
        { content: buildContent(draft, location), contact: draft.contact.trim() || undefined },
        accessToken,
      )
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

  const { type, kind } = draft

  const renderKindToggle = (labels: readonly [string, string]) => (
    <View style={styles.kindRow}>
      {(['new', 'fix'] as const).map((value, index) => {
        const active = kind === value
        return (
          <TouchableOpacity
            key={value}
            style={[styles.kindButton, active && styles.kindButtonActive]}
            onPress={() => update('kind', value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.kindText, active && styles.kindTextActive]}>{labels[index]}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  const renderPin = () => (
    <>
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
    </>
  )

  const contactField = (
    <>
      <FieldLabel>답변 받을 이메일 (선택)</FieldLabel>
      <TextField
        style={styles.field}
        placeholder="example@hongik.ac.kr"
        value={draft.contact}
        onChangeText={(value) => update('contact', value)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={100}
      />
    </>
  )

  const renderPartnerFields = () => (
    <>
      {renderKindToggle(['새 제휴 업체', '정보가 달라요'])}

      <FieldLabel>가게 이름 *</FieldLabel>
      <TextField
        style={[invalid('name') ? styles.fieldWithHint : styles.field, invalid('name') && styles.fieldInvalid]}
        placeholder="예: 발바리네"
        value={draft.name}
        onChangeText={(value) => update('name', value)}
        maxLength={50}
      />
      {invalid('name') && <Hint text={REQUIRED_HINT.name} />}

      <FieldLabel>위치 *</FieldLabel>
      {renderPin()}
      <TextField
        style={[
          invalid('location') ? styles.fieldWithHint : styles.field,
          invalid('location') && styles.fieldInvalid,
        ]}
        placeholder={location ? '상세 주소·층 (선택, 예: 1층 안쪽)' : '주소나 근처 건물 (예: 와우산로 128 1층)'}
        value={draft.address}
        onChangeText={(value) => update('address', value)}
        maxLength={100}
      />
      {invalid('location') && <Hint text={REQUIRED_HINT.location} />}

      <FieldLabel>제휴 소속 (알면 선택)</FieldLabel>
      <View style={styles.chipWrap}>
        {PARTNER_AFFILIATIONS.map((item) => {
          const active = draft.affiliation === item
          return (
            <Chip
              key={item}
              label={item}
              selected={active}
              onPress={() => update('affiliation', active ? null : item)}
            />
          )
        })}
      </View>

      <FieldLabel>{kind === 'new' ? '혜택' : '무엇이 다른가요?'}</FieldLabel>
      <TextField
        style={styles.field}
        areaHeight={100}
        placeholder={
          kind === 'new' ? '예: 학생증 제시 시 음료 1개 서비스' : '예: 혜택이 10% 할인에서 음료 서비스로 바뀌었어요'
        }
        value={draft.detail}
        onChangeText={(value) => update('detail', value)}
        multiline
        maxLength={500}
      />

      <FieldLabel>출처 (선택)</FieldLabel>
      <TextField
        style={styles.field}
        placeholder="인스타 게시물 링크, 가게 안내문 등"
        value={draft.source}
        onChangeText={(value) => update('source', value)}
        autoCapitalize="none"
        maxLength={200}
      />
    </>
  )

  const renderShowFields = () => {
    const isExhibition = type === 'exhibition'
    return (
      <>
        <FieldLabel>{isExhibition ? '전시 이름 *' : '행사 이름 *'}</FieldLabel>
        <TextField
          style={[invalid('name') ? styles.fieldWithHint : styles.field, invalid('name') && styles.fieldInvalid]}
          placeholder={isExhibition ? '예: 시각디자인과 졸업 전시' : '예: 대동제, 전공 설명회'}
          value={draft.name}
          onChangeText={(value) => update('name', value)}
          maxLength={80}
        />
        {invalid('name') && <Hint text={REQUIRED_HINT.name} />}

        <FieldLabel>장소 *</FieldLabel>
        <View style={styles.chipWrap} accessibilityRole="radiogroup" accessibilityLabel="열리는 곳">
          <Chip label="현장" selected={!draft.online} role="radio" onPress={() => update('online', false)} />
          <Chip label="온라인" selected={draft.online} role="radio" onPress={() => update('online', true)} />
        </View>
        {draft.online ? null : (
          <>
            <BuildingPicker
              value={draft.building}
              onChange={(name) => update('building', name)}
              invalid={invalid('place')}
            />
            {renderPin()}
          </>
        )}
        <TextField
          style={[invalid('place') ? styles.fieldWithHint : styles.field, invalid('place') && styles.fieldInvalid]}
          placeholder={draft.online ? '참여 방법·링크 (선택, 예: 유튜브 라이브, Zoom)' : '자세한 장소 (예: 1층 로비, 학교 밖이면 주소)'}
          value={draft.address}
          onChangeText={(value) => update('address', value)}
          maxLength={100}
        />
        {invalid('place') && <Hint text={REQUIRED_HINT.place} />}

        <FieldLabel>기간 *</FieldLabel>
        <TextField
          style={[invalid('period') ? styles.fieldWithHint : styles.field, invalid('period') && styles.fieldInvalid]}
          placeholder={isExhibition ? '예: 10/3 ~ 10/10, 10–18시' : '예: 10/3 ~ 10/5, 매년 5월'}
          value={draft.period}
          onChangeText={(value) => update('period', value)}
          maxLength={100}
        />
        {invalid('period') && <Hint text={REQUIRED_HINT.period} />}

        <FieldLabel>내용·링크 (선택)</FieldLabel>
        <TextField
          style={styles.field}
          areaHeight={100}
          placeholder="소개, 신청 방법, 인스타·홈페이지 링크 등"
          value={draft.detail}
          onChangeText={(value) => update('detail', value)}
          multiline
          maxLength={500}
        />
      </>
    )
  }

  const renderFacilityFields = () => (
    <>
      {renderKindToggle(['새로 생겼어요', '정보가 달라요'])}

      <FieldLabel>시설 종류 *</FieldLabel>
      <View style={[styles.chipWrap, invalid('facilityKind') && styles.chipWrapWithHint]}>
        {FACILITY_KIND_OPTIONS.map((item) => {
          const active = draft.facilityKind === item
          return (
            <Chip
              key={item}
              label={item}
              selected={active}
              role="radio"
              onPress={() => update('facilityKind', active ? null : item)}
              style={invalid('facilityKind') ? styles.chipInvalid : undefined}
            />
          )
        })}
      </View>
      {invalid('facilityKind') && <Hint text={REQUIRED_HINT.facilityKind} />}

      <FieldLabel>건물 *</FieldLabel>
      <BuildingPicker
        value={draft.building}
        onChange={(name) => update('building', name)}
        invalid={invalid('building')}
      />
      {invalid('building') && <Hint text={REQUIRED_HINT.building} />}
      <TextField
        style={styles.field}
        placeholder="층·호수 (선택, 예: 3층 R301 앞)"
        value={draft.floor}
        onChangeText={(value) => update('floor', value)}
        maxLength={50}
      />

      <FieldLabel>{kind === 'new' ? '새 시설 정보 *' : '무엇이 틀렸나요? *'}</FieldLabel>
      <TextField
        style={[invalid('detail') ? styles.fieldWithHint : styles.field, invalid('detail') && styles.fieldInvalid]}
        areaHeight={100}
        placeholder={
          kind === 'new'
            ? '예: 2층 라운지에 정수기가 새로 생겼어요. 평일 9–18시'
            : '예: 프린터가 3층이 아니라 4층에 있어요'
        }
        value={draft.detail}
        onChangeText={(value) => update('detail', value)}
        multiline
        maxLength={500}
      />
      {invalid('detail') && <Hint text={REQUIRED_HINT.detail} />}
    </>
  )

  const renderOtherFields = () => (
    <>
      <FieldLabel>내용 *</FieldLabel>
      <TextField
        style={[invalid('detail') ? styles.fieldWithHint : styles.field, invalid('detail') && styles.fieldInvalid]}
        areaHeight={140}
        placeholder="앱에 실렸으면 하는 정보, 바뀐 정보 등을 적어 주세요"
        value={draft.detail}
        onChangeText={(value) => update('detail', value)}
        multiline
        maxLength={800}
      />
      {invalid('detail') && <Hint text={REQUIRED_HINT.detail} />}
    </>
  )

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
          <ContentColumn>
          <ModalHeader title="정보 제보하기" onClose={onClose} />

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

                {type === 'partner' && renderPartnerFields()}
                {(type === 'exhibition' || type === 'event') && renderShowFields()}
                {type === 'facility' && renderFacilityFields()}
                {type === 'other' && renderOtherFields()}

                {contactField}

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
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  mapNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.fill,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  mapNoteText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18, color: COLORS.textSecondary },
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
  fieldWithHint: { marginBottom: 6 },
  fieldInvalid: { borderColor: COLORS.danger },
  hint: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.danger, marginBottom: 16 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 20 },
  chipWrapWithHint: { marginBottom: 8 },
  chipInvalid: { borderColor: COLORS.danger },
  pickerBlock: { marginBottom: 8 },
  searchField: { marginBottom: 8 },
  buildingRow: { gap: 7, paddingVertical: 2 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary, paddingVertical: 7 },
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
