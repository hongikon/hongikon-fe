import ListRow from '../common/ListRow'
import { NEARBY_FIELD_TEST } from '../../lib/nearbyPartners/debug'
import { nearbyAlertsAvailable, syncNearbyAlerts, type NearbySource } from '../../lib/nearbyPartners/background'
import { useNearbyAlertRow } from '../../hooks/settings/useNearbyAlertRow'
import { missingItems, nearbyRowDescription } from '../../utils/settings/nearby'
import ToggleSwitch from './ToggleSwitch'
import NearbyAlertModal from './nearby/NearbyAlertModal'

/**
 * 설정 > 알림 > "근처 제휴 알림". 근처 알림 빌드(`NEARBY_ALERTS_BUILD=1`)이고 로그인했을 때만 보인다.
 * - 줄: 켜고 끄는 스위치 + 지금 상태 한 줄(빠진 권한·받는 범위). 줄을 누르면 창이 열린다.
 * - 꺼져 있을 때 창: 안내·소속·수신 동의 → "항상 허용" 안내 화면 → 알림 권한 → 위치 "앱 사용 중" → "항상" → 감시 시작.
 * - 켜져 있을 때 창: "알림이 오려면" 점검표(빠진 권한 고치기), 받는 방법(밤에 받지 않기),
 *   내 소속, 알림 안 받는 가게, 모든 사용자의 반경 설정. 개발 도구(현장 테스트 빌드·관리자만)에는 횟수 제한·시험 알림이 있다.
 * 끄기: 감시·예약을 멈추고 서버 동의 시각을 지운다(수신 거부). 설계: `docs/nearby-partner-alert-release-plan.md`.
 * 상태는 hooks/settings/useNearbyAlertRow·useNearbyAlertFlow, 창의 칸들은 components/settings/nearby/*.
 */
export default function NearbyAlertSettings({
  openSignal = 0,
  onModalClose,
}: {
  openSignal?: number
  /** 창을 닫았을 때(설정 화면이 이 줄을 잠깐 강조하는 데 쓴다, 11-09). */
  onModalClose?: () => void
}) {
  const row = useNearbyAlertRow(openSignal)
  const { status, accessToken, data, settings, checklist, setModalVisible, refresh } = row

  if (!nearbyAlertsAvailable() || status !== 'authenticated' || !accessToken) return null

  const enabled = settings?.enabled === true
  const source: NearbySource = { partners: row.partners, campusPoints: row.buildings, serverEnabled: data?.nearbyAlertsEnabled === true }
  const serverPaused = !data?.nearbyAlertsEnabled && !NEARBY_FIELD_TEST
  const missing = missingItems(checklist)
  const turnOff = () => row.turnOff(accessToken)
  const description = nearbyRowDescription({ unsupported: row.unsupported, serverPaused, enabled, missing, settings })

  return (
    <>
      <ListRow
        icon="navigate-outline"
        label="근처 제휴 알림"
        description={description}
        value={enabled && missing.length > 0 ? '확인 필요' : undefined}
        onPress={() => setModalVisible(true)}
        last
        right={
          <ToggleSwitch
            value={enabled}
            onToggle={() => (enabled ? void turnOff() : setModalVisible(true))}
            locked={row.busy}
            accessibilityLabel={`근처 제휴 알림 ${enabled ? '켜짐' : '꺼짐'}`}
          />
        }
      />
      <NearbyAlertModal
        visible={row.modalVisible}
        settings={settings}
        checklist={checklist}
        serverPaused={serverPaused}
        onClose={() => {
          setModalVisible(false)
          onModalClose?.()
        }}
        onResync={async (affiliations, enable) => {
          const watching = await syncNearbyAlerts(source, { enable, affiliations })
          await refresh()
          return watching
        }}
        onRefresh={refresh}
        onTurnOff={async () => {
          await turnOff()
          setModalVisible(false)
        }}
        accessToken={accessToken}
      />
    </>
  )
}
