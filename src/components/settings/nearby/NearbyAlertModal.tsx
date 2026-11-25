import { Linking, ScrollView, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { layoutStyles } from '../../../constants/layout'
import { SHOW_DEVELOPER_TOOLS } from '../../../lib/nearbyPartners/debug'
import { DEFAULT_DWELL_MINUTES } from '../../../lib/nearbyPartners/rules'
import type { NearbyChecklist, NearbySettings } from '../../../lib/nearbyPartners/background'
import { useIsAdmin } from '../../../admin/AdminAccess'
import { useNearbyAlertFlow } from '../../../hooks/settings/useNearbyAlertFlow'
import type { PartnerAffiliation } from '../../../types'
import SwipeBackModal from '../../common/SwipeBackModal'
import Button from '../../common/Button'
import ModalHeader from '../ModalHeader'
import NearbyStatusSection from './NearbyStatusSection'
import NearbyRadiusSection from './NearbyRadiusSection'
import NearbyDeliverySection from './NearbyDeliverySection'
import NearbyAffiliationSection from './NearbyAffiliationSection'
import NearbyMutedSection from './NearbyMutedSection'
import NearbyConsentRow from './NearbyConsentRow'
import NearbyDevTools from './NearbyDevTools'
import { AlwaysAllowOverlay, LocationDisclosureOverlay } from './NearbyOverlays'
import { nearbyStyles as styles } from './styles'

interface Props {
  visible: boolean
  settings: NearbySettings | null
  checklist: NearbyChecklist | null
  serverPaused: boolean
  accessToken: string
  onClose: () => void
  /** 소속을 바꾸거나 켤 때 다시 등록한다. 실제로 감시를 시작했으면 true. */
  onResync: (affiliations: PartnerAffiliation[], enable: boolean) => Promise<boolean>
  onRefresh: () => Promise<void>
  onTurnOff: () => Promise<void>
}

/**
 * 근처 제휴 알림 창. 상태와 동작은 useNearbyAlertFlow, 칸들은 이 폴더의 Nearby*Section.
 * - 꺼져 있을 때: 안내·반경·받는 방법·소속·수신 동의 → '근처 제휴 알림 켜기'.
 * - 켜져 있을 때: 점검표·반경·받는 방법·소속·알림 안 받는 가게 → '수신 거부'/'완료'.
 */
export default function NearbyAlertModal({ visible, settings, checklist, serverPaused, accessToken, onClose, onResync, onRefresh, onTurnOff }: Props) {
  // 확인 도구: 테스트 앱 또는 운영 앱의 관리자 계정(11-10). 일반 사용자에게는 보이지 않는다.
  const isAdmin = useIsAdmin()
  const devTools = SHOW_DEVELOPER_TOOLS || isAdmin
  const adminOnly = !SHOW_DEVELOPER_TOOLS && isAdmin
  const flow = useNearbyAlertFlow({ visible, settings, accessToken, onClose, onResync, onRefresh })
  const { alreadyOn, step, working, run } = flow

  const muted = settings?.muted ?? []
  const dwell = settings?.dwellMinutes ?? DEFAULT_DWELL_MINUTES

  return (
    <SwipeBackModal visible={visible} onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ModalHeader title="근처 제휴 알림" onClose={onClose} />
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, layoutStyles.readable]}>
            <NearbyStatusSection
              alreadyOn={alreadyOn}
              checklist={checklist}
              serverPaused={serverPaused}
              onFixNotifications={() => void flow.fixNotifications()}
              onFixAlways={() => flow.setStep({ kind: 'needsAlways' })}
            />

            <NearbyRadiusSection radius={flow.radius} working={working} onChoose={flow.chooseRadius} />

            <NearbyDeliverySection
              settings={settings}
              dwell={dwell}
              working={working}
              unlimitedNote={devTools && flow.unlimited}
              run={run}
              onToggleNight={flow.toggleNight}
            />

            <NearbyAffiliationSection affiliations={flow.affiliations} working={working} onToggle={flow.toggleAffiliation} />

            {alreadyOn && <NearbyMutedSection muted={muted} working={working} run={run} />}

            {!alreadyOn && <NearbyConsentRow consent={flow.consent} onToggle={() => flow.setConsent((v) => !v)} />}

            {devTools && (
              <NearbyDevTools
                visible={visible}
                adminOnly={adminOnly}
                alreadyOn={alreadyOn}
                unlimited={flow.unlimited}
                working={working}
                testNote={flow.testNote}
                onToggleUnlimited={flow.toggleUnlimited}
                onSendTest={flow.sendTest}
                run={run}
              />
            )}

            {step.kind === 'working' && <Text style={styles.status}>{step.message}</Text>}
            {step.kind === 'error' && (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{step.message}</Text>
                {step.openSettings && (
                  <Button label="휴대폰 설정 열기" variant="secondary" size="md" onPress={() => Linking.openSettings().catch(() => {})} />
                )}
              </View>
            )}
          </ScrollView>
          <View style={[styles.footer, layoutStyles.readable, alreadyOn && styles.footerRow]}>
            {alreadyOn ? (
              <>
                <View style={styles.footerItem}>
                  <Button label="수신 거부" variant="secondary" size="lg" onPress={() => void onTurnOff()} disabled={working} />
                </View>
                <View style={styles.footerItem}>
                  <Button label="완료" size="lg" onPress={onClose} />
                </View>
              </>
            ) : (
              <Button label="근처 제휴 알림 켜기" size="lg" onPress={() => void flow.begin()} disabled={!flow.consent} loading={working} />
            )}
          </View>
          {step.kind === 'explain' && (
            <LocationDisclosureOverlay onAgree={() => void flow.agreeLocation()} onDecline={() => flow.setStep({ kind: 'form' })} />
          )}
          {(step.kind === 'chooseAlways' || step.kind === 'needsAlways') && (
            <AlwaysAllowOverlay
              afterSettings={step.kind === 'needsAlways'}
              onContinue={() => void flow.chooseAlways()}
              onCancel={() => flow.setStep({ kind: 'form' })}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </SwipeBackModal>
  )
}
