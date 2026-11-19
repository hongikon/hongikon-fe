import TextField, { FieldLabel } from '../../common/TextField'
import { infoStyles as styles } from './styles'

/** 답변 받을 이메일(선택). 모든 종류 아래에 붙는다. */
export default function ContactField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <>
      <FieldLabel>답변 받을 이메일 (선택)</FieldLabel>
      <TextField
        style={styles.field}
        placeholder="example@hongik.ac.kr"
        value={value}
        onChangeText={onChange}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={100}
      />
    </>
  )
}
