import TextField, { FieldLabel } from '../../common/TextField'
import type { InfoSuggestForm } from '../../../hooks/settings/useInfoSuggestForm'
import { REQUIRED_HINT } from '../../../utils/settings/infoSuggest'
import { Hint } from './FormBits'
import { infoStyles as styles } from './styles'

/** 기타 칸: 내용만. */
export default function OtherFields({ form }: { form: InfoSuggestForm }) {
  const { draft, update, invalid } = form
  return (
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
}
