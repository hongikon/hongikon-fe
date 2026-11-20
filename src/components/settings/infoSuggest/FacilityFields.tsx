import { View } from 'react-native'
import { FACILITY_KINDS } from '../../../constants/facilityKinds'
import Chip from '../../common/Chip'
import TextField, { FieldLabel } from '../../common/TextField'
import type { InfoSuggestForm } from '../../../hooks/settings/useInfoSuggestForm'
import { REQUIRED_HINT } from '../../../utils/settings/infoSuggest'
import BuildingPicker from './BuildingPicker'
import { Hint, KindToggle } from './FormBits'
import { infoStyles as styles } from './styles'

/**
 * 시설 종류 칩. 전시·행사는 위 종류 칩으로 따로 받으므로 빼고, 목록에 없는 시설용 칸을 둔다.
 * 흡연구역은 지도 칩에 다시 보이면서(10-27) 여기서도 고를 수 있다.
 */
const FACILITY_KIND_OPTIONS: readonly string[] = [
  ...FACILITY_KINDS.filter((meta) => meta.key !== '행사·전시').map((meta) => meta.key),
  '그 밖의 시설',
]

/** 시설 정보 칸: 새로/정보 수정 · 시설 종류 · 건물·층 · 내용. */
export default function FacilityFields({ form }: { form: InfoSuggestForm }) {
  const { draft, update, invalid } = form
  const { kind } = draft
  return (
    <>
      <KindToggle kind={kind} labels={['새로 생겼어요', '정보가 달라요']} onChange={(value) => update('kind', value)} />

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
}
