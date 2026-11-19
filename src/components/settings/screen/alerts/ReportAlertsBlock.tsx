import { Text, View } from 'react-native'
import ListRow from '../../../common/ListRow'
import ToggleSwitch from '../../ToggleSwitch'
import ReportKeywordAlerts from '../../ReportKeywordAlerts'
import type { useReportKeywordAlerts } from '../../../../hooks/useReportKeywordAlerts'
import { settingsStyles as s } from '../styles'

interface Props {
  isGuest: boolean
  dimmed: boolean
  reportStatusAlert: boolean
  newReportAlert: boolean
  /** 새 제보 알림 범위가 '내 키워드'일 때 설명을 바꾼다. */
  keywordScopeOn: boolean
  showReportKeywords: boolean
  reportKeywords: ReturnType<typeof useReportKeywordAlerts>
  guarded: (action: () => void) => () => void
  onToggleReportStatus: () => void
  onToggleNewReport: () => void
}

/** 제보 알림 칸. 제보는 기기 위치(GPS)를 쓰지 않아 "근처" 대신 캠퍼스 전체 단위로 받는다. */
export default function ReportAlertsBlock({
  isGuest,
  dimmed,
  reportStatusAlert,
  newReportAlert,
  keywordScopeOn,
  showReportKeywords,
  reportKeywords,
  guarded,
  onToggleReportStatus,
  onToggleNewReport,
}: Props) {
  return (
    <View style={[s.subBlock, dimmed && s.dimmed]}>
      <Text style={s.subHeader}>제보 알림</Text>
      <ListRow
        icon="checkmark-done-outline"
        label="내 제보 결과 알림"
        description="올린 제보가 지도에 올라가거나 반려되면, 내 제보에 댓글이나 내 댓글에 답글이 달리거나 공감이 모이면 알려드려요"
        right={
          <ToggleSwitch
            value={reportStatusAlert}
            onToggle={guarded(onToggleReportStatus)}
            locked={isGuest}
            accessibilityLabel={`내 제보 결과 알림 ${reportStatusAlert ? '켜짐' : '꺼짐'}`}
          />
        }
      />
      <ListRow
        icon="megaphone-outline"
        label="캠퍼스 새 제보 알림"
        description={
          keywordScopeOn
            ? '운영진이 확인한 새 제보 중 내 키워드가 들어간 제보가 지도에 올라오면 바로 알려드려요.'
            : '운영진이 확인한 새 제보가 지도에 올라오면 알려드려요. 여러 건이 몰리면 30분에 한 번 모아서 보내고, 밤 11시~아침 8시엔 쉬었다가 아침에 모아 보내요.'
        }
        last={!showReportKeywords}
        right={
          <ToggleSwitch
            value={newReportAlert}
            onToggle={guarded(onToggleNewReport)}
            locked={isGuest}
            accessibilityLabel={`캠퍼스 새 제보 알림 ${newReportAlert ? '켜짐' : '꺼짐'}`}
          />
        }
      />
      {showReportKeywords && (
        <ReportKeywordAlerts
          status={reportKeywords.status}
          scope={reportKeywords.scope}
          keywords={reportKeywords.keywords}
          onRetry={reportKeywords.retry}
          onChangeScope={reportKeywords.changeScope}
          onAdd={reportKeywords.addKeyword}
          onRemove={reportKeywords.removeKeyword}
        />
      )}
    </View>
  )
}
