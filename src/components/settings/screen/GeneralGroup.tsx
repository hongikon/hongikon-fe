import { View } from 'react-native'
import ListRow from '../../common/ListRow'
import { UpdateHistoryRow } from '../UpdateHistoryModal'
import { SHOW_DEVELOPER_TOOLS } from '../../../lib/appVariant'
import type { SettingsModalType } from '../../../hooks/settings/types'
import GroupHeader from './GroupHeader'
import { settingsStyles as s } from './styles'

interface Props {
  expanded: boolean
  onToggle: () => void
  /** 알림 권한이 꺼져 있을 때 '앱 권한' 줄에 보일 요약. */
  permissionSummary: string | undefined
  hiddenCount: number
  openModal: (modal: SettingsModalType) => void
  onOpenAppStatus: () => void
  onReset: () => void
}

/** 설정 > 일반 묶음: 앱 권한 · 공지사항 · 업데이트 내역 · 숨긴 사용자 · 학교 · (개발용) 앱 상태 · 설정 초기화. */
export default function GeneralGroup({ expanded, onToggle, permissionSummary, hiddenCount, openModal, onOpenAppStatus, onReset }: Props) {
  return (
    <View style={s.section}>
      <GroupHeader icon="options-outline" label="일반" expanded={expanded} onPress={onToggle} />
      {expanded && (
        <View style={s.groupBody}>
          <ListRow icon="key-outline" label="앱 권한" value={permissionSummary} onPress={() => openModal('permissions')} />
          <ListRow icon="megaphone-outline" label="공지사항" onPress={() => openModal('notices')} />
          <UpdateHistoryRow />
          <ListRow
            icon="eye-off-outline"
            label="숨긴 사용자"
            value={hiddenCount > 0 ? `${hiddenCount}명` : undefined}
            onPress={() => openModal('hiddenUsers')}
          />
          <ListRow icon="school-outline" label="학교" value="홍익대학교" />
          {/* 개발자용 화면이라 운영 빌드에서는 숨긴다(개발 서버·개발/테스트 빌드에서만 보임). */}
          {SHOW_DEVELOPER_TOOLS && <ListRow icon="pulse-outline" label="앱 상태 확인" onPress={onOpenAppStatus} />}
          <ListRow icon="refresh-outline" label="설정 초기화" danger last onPress={onReset} />
        </View>
      )}
    </View>
  )
}
