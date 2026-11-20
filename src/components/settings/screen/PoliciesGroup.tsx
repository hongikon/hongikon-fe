import { View } from 'react-native'
import ListRow from '../../common/ListRow'
import type { SettingsModalType } from '../../../hooks/settings/types'
import GroupHeader from './GroupHeader'
import { settingsStyles as s } from './styles'

interface Props {
  expanded: boolean
  onToggle: () => void
  openModal: (modal: SettingsModalType) => void
}

/** 설정 > 약관 및 정책 묶음. */
export default function PoliciesGroup({ expanded, onToggle, openModal }: Props) {
  return (
    <View style={s.section}>
      <GroupHeader icon="document-text-outline" label="약관 및 정책" expanded={expanded} onPress={onToggle} />
      {expanded && (
        <View style={s.groupBody}>
          <ListRow icon="document-text-outline" label="이용약관" onPress={() => openModal('terms')} />
          <ListRow icon="shield-checkmark-outline" label="개인정보 처리방침" onPress={() => openModal('privacy')} />
          <ListRow icon="code-slash-outline" label="오픈소스 라이선스" onPress={() => openModal('licenses')} last />
        </View>
      )}
    </View>
  )
}
