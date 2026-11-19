import { View } from 'react-native'
import ListRow from '../../common/ListRow'
import { PARTNER_SOURCES } from '../../../constants/partnerSources'
import type { SettingsModalType } from '../../../hooks/settings/types'
import GroupHeader from './GroupHeader'
import { settingsStyles as s } from './styles'

interface Props {
  expanded: boolean
  onToggle: () => void
  openModal: (modal: SettingsModalType) => void
}

/** 설정 > 고객 지원 묶음: 자주 묻는 질문 · 문의하기 · 정보 제보 · 제휴 출처. */
export default function SupportGroup({ expanded, onToggle, openModal }: Props) {
  return (
    <View style={s.section}>
      <GroupHeader icon="help-buoy-outline" label="고객 지원" expanded={expanded} onPress={onToggle} />
      {expanded && (
        <View style={s.groupBody}>
          <ListRow icon="help-buoy-outline" label="자주 묻는 질문·계정 삭제 안내" onPress={() => openModal('support')} />
          <ListRow icon="chatbubble-ellipses-outline" label="문의하기" onPress={() => openModal('feedback')} />
          <ListRow icon="storefront-outline" label="정보 제보하기" onPress={() => openModal('infoSuggest')} />
          <ListRow
            icon="logo-instagram"
            label="제휴 출처"
            value={`${PARTNER_SOURCES.length}개 소속`}
            onPress={() => openModal('sources')}
            last
          />
        </View>
      )}
    </View>
  )
}
