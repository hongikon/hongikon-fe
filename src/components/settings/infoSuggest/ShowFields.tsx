import type { ReactNode } from 'react'
import { View } from 'react-native'
import Chip from '../../common/Chip'
import TextField, { FieldLabel } from '../../common/TextField'
import type { InfoSuggestForm } from '../../../hooks/settings/useInfoSuggestForm'
import { REQUIRED_HINT } from '../../../utils/settings/infoSuggest'
import BuildingPicker from './BuildingPicker'
import { Hint } from './FormBits'
import { infoStyles as styles } from './styles'

/** 전시·행사 칸: 이름 · 장소(현장/온라인, 건물·핀·자세한 장소) · 기간 · 내용. */
export default function ShowFields({ form, pin }: { form: InfoSuggestForm; pin: ReactNode }) {
  const { draft, update, invalid } = form
  const isExhibition = draft.type === 'exhibition'
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
          {pin}
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
