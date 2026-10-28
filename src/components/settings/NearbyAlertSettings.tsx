import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS, SPACING } from '../../constants/spacing'
import { layoutStyles } from '../../constants/layout'
import { PARTNER_AFFILIATIONS } from '../../constants/partnerAffiliations'
import { useAuth } from '../../contexts/AuthContext'
import { useMapData } from '../../lib/mapData'
import { requestNotificationPermission } from '../../lib/notificationPermission'
import { patchNotificationSettings } from '../../apis/notificationSettings'
import { NEARBY_FIELD_TEST, SHOW_DEVELOPER_TOOLS } from '../../lib/nearbyPartners/debug'
import {
  disableNearbyAlerts,
  getNearbyDebugInfo,
  getNearbyPermission,
  getNearbySettings,
  nearbyAlertsAvailable,
  nearbyGeofencingUnsupported,
  requestNearbyPermission,
  syncNearbyAlerts,
} from '../../lib/nearbyPartners/background'
import { PARTNER_REGION_RADIUS_METERS } from '../../lib/nearbyPartners/rules'
import ListRow from '../common/ListRow'
import Button from '../common/Button'
import ToggleSwitch from './ToggleSwitch'
import ModalHeader from './ModalHeader'
import type { PartnerAffiliation } from '../../types'

/**
 * 설정 > 알림 > "근처 제휴 알림". 근처 알림 빌드(`NEARBY_ALERTS_BUILD=1`)이고 로그인했을 때만 보인다.
 * 켜기: 안내·소속·광고성 정보 수신 동의 → 알림 권한 → 위치 "앱 사용 중" → "항상" → 서버에 동의 시각 저장 → 감시 시작.
 * 끄기: 감시·예약을 멈추고 서버 동의 시각을 지운다(수신 거부).
 * 설계와 규칙: `docs/nearby-partner-alert-impl-plan.md`.
 */
export default function NearbyAlertSettings() {
  const { status, accessToken } = useAuth()
  const { data, partners, buildings } = useMapData()
  const [enabled, setEnabled] = useState(false)
  const [affiliation, setAffiliation] = useState<PartnerAffiliation | null>(null)
  const [setupVisible, setSetupVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [debugLine, setDebugLine] = useState<string | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  const refresh = useCallback(async () => {
    const settings = await getNearbySettings()
    setEnabled(settings.enabled)
    setAffiliation(settings.affiliation)
    setUnsupported(nearbyGeofencingUnsupported())
    if (SHOW_DEVELOPER_TOOLS) {
      const info = await getNearbyDebugInfo()
      if (info) {
        const { last, lastEvent, state } = info
        const pending = state.pending ? ` · 예약 ${state.targets.find((t) => t.id === state.pending?.partnerId)?.name ?? state.pending.partnerId}` : ''
        setDebugLine(
          `[개발] 대상 ${state.targets.length}곳 · ${last ? `${last.result} ${last.regions}곳 · 다시 고르기 ${last.reselectMeters}m${last.error ? ` (${last.error})` : ''}` : '등록 전'} · 머묾 ${Object.values(state.stays).filter((s) => s.exitedAt === null).length}곳 · 보냄 ${state.sent.length}${pending}${lastEvent ? ` · 신호 ${lastEvent.kind} ${state.targets.find((t) => t.id === lastEvent.id)?.name ?? lastEvent.id}` : ''}`,
        )
      }
    }
  }, [])

  // 개발·테스트 빌드: 자동 테스트가 상태를 읽을 수 있게 몇 초마다 갱신한다.
  useEffect(() => {
    if (!SHOW_DEVELOPER_TOOLS) return
    const id = setInterval(() => void refresh(), 3000)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    void refresh()
  }, [refresh, status])

  if (!nearbyAlertsAvailable() || status !== 'authenticated' || !accessToken) return null

  const source = { partners, campusPoints: buildings, serverEnabled: data?.nearbyAlertsEnabled === true }

  const turnOff = async () => {
    setBusy(true)
    await disableNearbyAlerts()
    // 수신 거부를 서버 기록에도 남긴다. 실패해도 기기에서는 이미 꺼졌다(다음에 켤 때 다시 동의를 받는다).
    if (!NEARBY_FIELD_TEST) patchNotificationSettings({ partnerAdConsent: false }, accessToken).catch(() => {})
    setEnabled(false)
    setBusy(false)
  }

  const description = unsupported
    ? '이 휴대폰은 위치 영역 알림(지오펜스)을 지원하지 않아 근처 알림이 오지 않아요.'
    : !data?.nearbyAlertsEnabled && !NEARBY_FIELD_TEST
    ? '지금은 운영진이 근처 알림을 잠시 멈췄어요.'
    : enabled
      ? `${affiliation ? `${affiliation}·총학생회` : '총학생회'} 제휴 업체 근처에 5분 넘게 머물면 혜택을 알려 드려요.`
      : '제휴 업체 근처에 머물면 받을 수 있는 혜택을 알려 드려요(광고성 정보).'

  return (
    <>
      <ListRow
        icon="navigate-outline"
        label="근처 제휴 알림"
        description={debugLine ? `${description}\n${debugLine}` : description}
        value={enabled ? (affiliation ?? '총학생회') : undefined}
        onPress={enabled ? () => setSetupVisible(true) : undefined}
        last
        right={
          <ToggleSwitch
            value={enabled}
            onToggle={() => (enabled ? void turnOff() : setSetupVisible(true))}
            locked={busy}
            accessibilityLabel={`근처 제휴 알림 ${enabled ? '켜짐' : '꺼짐'}`}
          />
        }
      />
      <NearbyAlertSetupModal
        visible={setupVisible}
        alreadyOn={enabled}
        initialAffiliation={affiliation}
        onClose={() => setSetupVisible(false)}
        onDone={async (nextAffiliation) => {
          const watching = await syncNearbyAlerts(source, { enable: true, affiliation: nextAffiliation })
          await refresh()
          return watching
        }}
        accessToken={accessToken}
      />
    </>
  )
}

type Step =
  | { kind: 'form' }
  | { kind: 'working'; message: string }
  | { kind: 'needsAlways' }
  | { kind: 'error'; message: string; openSettings?: boolean }

interface SetupProps {
  visible: boolean
  alreadyOn: boolean
  initialAffiliation: PartnerAffiliation | null
  accessToken: string
  onClose: () => void
  /** 켜기 마지막 단계. 실제로 감시를 시작했으면 true. */
  onDone: (affiliation: PartnerAffiliation | null) => Promise<boolean>
}

function NearbyAlertSetupModal({ visible, alreadyOn, initialAffiliation, accessToken, onClose, onDone }: SetupProps) {
  const [affiliation, setAffiliation] = useState<PartnerAffiliation | null>(initialAffiliation)
  const [consent, setConsent] = useState(alreadyOn)
  const [step, setStep] = useState<Step>({ kind: 'form' })

  // 창이 열릴 때만 처음 상태로 되돌린다. 켜는 도중 alreadyOn 이 바뀌어도 안내·오류 문구를 지우지 않게(10-28 테스트).
  useEffect(() => {
    if (!visible) return
    setAffiliation(initialAffiliation)
    setConsent(alreadyOn)
    setStep({ kind: 'form' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const finish = useCallback(async () => {
    setStep({ kind: 'working', message: '근처 제휴 업체를 등록하는 중이에요' })
    // 현장 테스트 빌드(TestFlight 내부)는 서버에 동의 필드가 없어도 돌게 기기에만 남긴다.
    if (!NEARBY_FIELD_TEST) {
      try {
        // 동의 시각을 서버에 남긴다(정보통신망법 동의 기록). 이 필드를 모르는 서버면 켜지 않는다.
        const saved = await patchNotificationSettings({ partnerAdConsent: true }, accessToken)
        if (!saved.partnerAdConsentAt) {
          setStep({ kind: 'error', message: '서버가 아직 근처 알림을 지원하지 않아요. 잠시 뒤 다시 시도해 주세요.' })
          return
        }
      } catch {
        setStep({ kind: 'error', message: '수신 동의를 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.' })
        return
      }
    }
    const watching = await onDone(affiliation)
    if (!watching) {
      setStep({ kind: 'error', message: '켜 두었어요. 지금은 위치를 확인하지 못해, 앱을 다시 열면 근처 업체를 등록해요.' })
      return
    }
    onClose()
  }, [accessToken, affiliation, onClose, onDone])

  // "항상 허용"을 고르러 휴대폰 설정에 다녀오면 다시 확인해 이어서 켠다.
  useEffect(() => {
    if (!visible || step.kind !== 'needsAlways') return
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return
      if ((await getNearbyPermission()).status === 'granted') void finish()
    })
    return () => sub.remove()
  }, [visible, step.kind, finish])

  const start = async () => {
    setStep({ kind: 'working', message: '권한을 확인하는 중이에요' })
    const notification = await requestNotificationPermission()
    if (notification.status !== 'granted') {
      setStep({ kind: 'error', message: '알림 권한이 꺼져 있어 근처 알림을 보낼 수 없어요. 휴대폰 설정에서 알림을 켜 주세요.', openSettings: true })
      return
    }
    const location = await requestNearbyPermission()
    if (location.status === 'granted') {
      void finish()
      return
    }
    if (location.status === 'foregroundOnly') {
      setStep({ kind: 'needsAlways' })
      return
    }
    setStep({
      kind: 'error',
      message: '위치 권한이 없어 근처 업체를 알 수 없어요. 휴대폰 설정에서 위치를 "항상 허용"으로 바꿔 주세요.',
      openSettings: true,
    })
  }

  const saveAffiliationOnly = async () => {
    setStep({ kind: 'working', message: '저장하는 중이에요' })
    await onDone(affiliation)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ModalHeader title="근처 제휴 알림" onClose={onClose} />
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, layoutStyles.readable]}>
            <View style={styles.card}>
              {[
                `제휴 업체 ${PARTNER_REGION_RADIUS_METERS}m 안에 5분 넘게 머물면 그 업체 혜택을 한 번 알려 드려요.`,
                '하루 최대 2번, 같은 업체는 하루 1번, 알림 사이는 2시간 넘게 띄워요. 밤 9시~아침 8시에는 보내지 않아요.',
                '위치는 휴대폰 안에서 근처 업체를 찾는 데만 쓰고, 서버로 보내거나 저장하지 않아요.',
                '앱을 쓰지 않을 때도 확인하려면 위치를 "항상 허용"으로 바꿔야 해요.',
                '옆 가게에 있어도 알림이 갈 수 있고, 일부 휴대폰에서는 늦거나 오지 않을 수 있어요.',
              ].map((line) => (
                <View key={line} style={styles.bulletRow}>
                  <Text style={styles.bullet}>·</Text>
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.label}>내 소속(선택)</Text>
            <Text style={styles.hint}>고른 소속과 총학생회 제휴 업체만 알려 드려요. 고르지 않으면 총학생회 제휴만.</Text>
            <View style={styles.chips}>
              {PARTNER_AFFILIATIONS.filter((item) => item !== '총학생회').map((item) => {
                const selected = affiliation === item
                return (
                  <Pressable
                    key={item}
                    onPress={() => setAffiliation(selected ? null : item)}
                    style={[styles.chip, selected && styles.chipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`소속 ${item}`}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextOn]}>{item}</Text>
                  </Pressable>
                )
              })}
            </View>

            {!alreadyOn && (
              <Pressable
                onPress={() => setConsent((v) => !v)}
                style={styles.consentRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                accessibilityLabel="제휴 혜택 안내(광고성 정보) 알림 수신 동의"
              >
                <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={COLORS.primary} />
                <View style={styles.consentBody}>
                  <Text style={styles.consentTitle}>(필수) 제휴 혜택 안내(광고성 정보) 알림 수신에 동의해요</Text>
                  <Text style={styles.hint}>
                    알림 제목에 "(광고)"가 붙어요. 설정에서 언제든 끌 수 있고(수신 거부), 동의 여부를 2년마다 다시 알려 드려요.
                  </Text>
                </View>
              </Pressable>
            )}

            {step.kind === 'working' && <Text style={styles.status}>{step.message}</Text>}
            {step.kind === 'needsAlways' && (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  위치가 "앱을 사용하는 동안"으로만 허용돼 있어요. 휴대폰 설정 &gt; 위치에서 "항상 허용"을 고르고 돌아오면 이어서 켜요.
                </Text>
                <Button label="휴대폰 설정 열기" variant="secondary" size="md" onPress={() => Linking.openSettings().catch(() => {})} />
              </View>
            )}
            {step.kind === 'error' && (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{step.message}</Text>
                {step.openSettings && (
                  <Button label="휴대폰 설정 열기" variant="secondary" size="md" onPress={() => Linking.openSettings().catch(() => {})} />
                )}
              </View>
            )}
          </ScrollView>
          <View style={[styles.footer, layoutStyles.readable]}>
            {alreadyOn ? (
              <Button label="저장" size="lg" onPress={saveAffiliationOnly} loading={step.kind === 'working'} />
            ) : (
              <Button label="근처 제휴 알림 켜기" size="lg" onPress={start} disabled={!consent} loading={step.kind === 'working'} />
            )}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, gap: 8 },
  bulletRow: { flexDirection: 'row', gap: 6 },
  bullet: { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary, fontFamily: FONTS.regular },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20, color: COLORS.textPrimary, fontFamily: FONTS.regular },
  label: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginTop: SPACING.sm },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.chipText },
  chipTextOn: { color: COLORS.white },
  consentRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
  },
  consentBody: { flex: 1, gap: 4 },
  consentTitle: { fontSize: 14, lineHeight: 20, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  status: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  notice: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.lg, gap: SPACING.md },
  noticeText: { fontSize: 14, lineHeight: 20, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  footer: { padding: SPACING.lg },
})
