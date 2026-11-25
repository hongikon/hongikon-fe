import { Text, View } from 'react-native'
import ListRow from '../../../common/ListRow'
import ToggleSwitch from '../../ToggleSwitch'
import type { AdminAlertSettingState } from '../../../../hooks/settings/useAdminAlertSetting'
import { settingsStyles as s } from '../styles'

interface Props {
  dimmed: boolean
  state: AdminAlertSettingState
  toggle: () => void
  retry: () => void
}

/** 관리자 알림 칸 — 관리자 계정에만, 서버가 이 설정을 알 때만 그린다(부모가 거른다). */
export default function AdminAlertBlock({ dimmed, state, toggle, retry }: Props) {
  return (
    <View style={[s.subBlock, dimmed && s.dimmed]}>
      <Text style={s.subHeader}>관리자</Text>
      <ListRow
        icon="shield-checkmark-outline"
        label="관리자 알림"
        description="새 제보 승인 대기·새 문의·신고로 자동 숨김된 제보를 알려드려요. 몰리면 2분에 한 번 묶어서 와요."
        value={state.status === 'loading' ? '불러오는 중' : state.status === 'error' ? '다시 시도' : undefined}
        onPress={state.status === 'error' ? retry : undefined}
        last
        right={
          state.status === 'ready' ? (
            <ToggleSwitch
              value={state.enabled}
              onToggle={toggle}
              accessibilityLabel={`관리자 알림 ${state.enabled ? '켜짐' : '꺼짐'}`}
            />
          ) : undefined
        }
      />
    </View>
  )
}
