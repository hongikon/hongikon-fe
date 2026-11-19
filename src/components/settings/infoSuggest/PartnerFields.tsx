import type { ReactNode } from 'react'
import { View } from 'react-native'
import { PARTNER_AFFILIATIONS } from '../../../constants/partnerAffiliations'
import Chip from '../../common/Chip'
import TextField, { FieldLabel } from '../../common/TextField'
import type { InfoSuggestForm } from '../../../hooks/settings/useInfoSuggestForm'
import { REQUIRED_HINT, type InfoSuggestLocation } from '../../../utils/settings/infoSuggest'
import { Hint, KindToggle } from './FormBits'
import { infoStyles as styles } from './styles'

interface Props {
  form: InfoSuggestForm
  location: InfoSuggestLocation | null
  /** 찍은 위치·지도에서 찍기 버튼(PinPicker). */
  pin: ReactNode
}

/** 제휴·혜택 칸: 새 업체/정보 수정 · 가게 이름 · 위치 · 소속 · 혜택 · 출처. */
export default function PartnerFields({ form, location, pin }: Props) {
  const { draft, update, setDraft, invalid } = form
  const { kind } = draft
  return (
    <>
      <KindToggle kind={kind} labels={['새 제휴 업체', '정보가 달라요']} onChange={(value) => update('kind', value)} />

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
      {pin}
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

      <FieldLabel>제휴 소속 (선택)</FieldLabel>
      <View style={styles.chipWrap}>
        {PARTNER_AFFILIATIONS.map((item) => {
          const active = draft.affiliationCustom == null && draft.affiliation === item
          return (
            <Chip
              key={item}
              label={item}
              selected={active}
              onPress={() =>
                setDraft((prev) => ({ ...prev, affiliation: active ? null : item, affiliationCustom: null }))
              }
            />
          )
        })}
        {/* 동아리·학과 학생회처럼 목록에 없는 소속과 맺은 제휴도 있다(10-12 요청). */}
        <Chip
          label="직접 입력"
          selected={draft.affiliationCustom != null}
          onPress={() =>
            setDraft((prev) => ({
              ...prev,
              affiliation: null,
              affiliationCustom: prev.affiliationCustom != null ? null : '',
            }))
          }
        />
      </View>
      {draft.affiliationCustom != null && (
        <TextField
          style={styles.field}
          placeholder="예: 중앙동아리 OO, OO학과 학생회"
          value={draft.affiliationCustom}
          onChangeText={(value) => update('affiliationCustom', value)}
          maxLength={50}
        />
      )}

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
}
