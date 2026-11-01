import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
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
import {
  NEARBY_FIELD_TEST,
  SHOW_DEVELOPER_TOOLS,
  fieldTestUnlimited,
  partnerRadiusMeters,
  setFieldTestUnlimited,
  setPartnerRadius,
} from '../../lib/nearbyPartners/debug'
import {
  disableNearbyAlerts,
  getNearbyChecklist,
  getNearbyDebugInfo,
  getNearbyPermission,
  getNearbySettings,
  nearbyAlertsAvailable,
  nearbyGeofencingUnsupported,
  requestNearbyPermission,
  resetNearbyHistoryForDebug,
  sendNearbyTestAlert,
  setNearbyPrefs,
  syncNearbyAlerts,
  unmuteNearbyPartner,
  type NearbyChecklist,
  type NearbySettings,
  type NearbySource,
} from '../../lib/nearbyPartners/background'
import {
  ALERT_RADIUS_METERS,
  DEFAULT_DWELL_MINUTES,
  MAX_DWELL_MINUTES,
  MIN_DWELL_MINUTES,
  MAX_ALERTS_PER_DAY,
  PARTNER_REGION_RADIUS_METERS,
  QUIET_END_HOUR,
  QUIET_START_HOUR,
} from '../../lib/nearbyPartners/rules'
import ListRow from '../common/ListRow'
import SwipeBackModal from '../common/SwipeBackModal'
import Button from '../common/Button'
import ToggleSwitch from './ToggleSwitch'
import ModalHeader from './ModalHeader'
import type { PartnerAffiliation } from '../../types'

/** 테스트 빌드에서 고를 수 있는 업체 반경(m). */
const TEST_RADIUS_OPTIONS = [20, 30, 50, 100] as const
/** 위치를 "항상 허용"해야 하는 이유 — 켜기 전 안내와 권한이 모자랄 때 같은 말을 쓴다. */
const ALWAYS_ALLOW_NOTICE =
  '위치를 "항상 허용"으로 해 두어야 제휴 가게에 머물 때 바로 알림을 받을 수 있어요. "앱을 사용하는 동안"만 허용하면 앱을 닫았을 때는 알림이 오지 않아요.'
const NIGHT_LABEL = `밤 ${QUIET_START_HOUR}시~아침 ${QUIET_END_HOUR}시에도 받기`
/** 켜면 야간 수신 별도 동의가 된다(정보통신망법 제50조 제3항) — 기본은 꺼짐이라 이 시간엔 오지 않는다. */
const NIGHT_HINT = `켜면 이 시간에도 제휴 혜택 알림을 받는 데 동의해요(야간 수신 동의). 끄면 동의를 거두고 밤 ${QUIET_START_HOUR}시~아침 ${QUIET_END_HOUR}시에는 보내지 않아요.`

function affiliationLabel(affiliations: readonly PartnerAffiliation[]): string {
  return [...affiliations, '총학생회'].join('·')
}

/** 알림이 오는 데 빠진 것(설정 줄 안내·점검표). */
function missingItems(checklist: NearbyChecklist | null): string[] {
  if (!checklist) return []
  const missing: string[] = []
  if (!checklist.notifications) missing.push('알림 허용')
  if (!checklist.always) missing.push('위치 "항상"')
  if (checklist.precise === false) missing.push('정확한 위치')
  return missing
}

/**
 * 설정 > 알림 > "근처 제휴 알림". 근처 알림 빌드(`NEARBY_ALERTS_BUILD=1`)이고 로그인했을 때만 보인다.
 * - 줄: 켜고 끄는 스위치 + 지금 상태 한 줄(빠진 권한·받는 범위). 줄을 누르면 창이 열린다.
 * - 꺼져 있을 때 창: 안내·소속·수신 동의 → "항상 허용" 안내 화면 → 알림 권한 → 위치 "앱 사용 중" → "항상" → 감시 시작.
 * - 켜져 있을 때 창: "알림이 오려면" 점검표(빠진 권한 고치기), 받는 방법(밤에 받지 않기),
 *   내 소속, 알림 안 받는 가게, (테스트 앱) 반경·횟수 제한·시험 알림. 바꾸면 바로 저장된다.
 * 끄기: 감시·예약을 멈추고 서버 동의 시각을 지운다(수신 거부). 설계: `docs/nearby-partner-alert-release-plan.md`.
 */
export default function NearbyAlertSettings({ openSignal = 0 }: { openSignal?: number }) {
  const { status, accessToken } = useAuth()
  const { data, partners, buildings } = useMapData()
  const [settings, setSettings] = useState<NearbySettings | null>(null)
  const [checklist, setChecklist] = useState<NearbyChecklist | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [debugLine, setDebugLine] = useState<string | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  const refresh = useCallback(async () => {
    setSettings(await getNearbySettings())
    setChecklist(await getNearbyChecklist())
    setUnsupported(nearbyGeofencingUnsupported())
    if (SHOW_DEVELOPER_TOOLS) {
      const info = await getNearbyDebugInfo()
      if (info) {
        const { last, lastEvent, state, schedule } = info
        const pending = state.pending ? ` · 예약 ${state.targets.find((t) => t.id === state.pending?.partnerId)?.name ?? state.pending.partnerId}` : ''
        setDebugLine(
          `[개발] 대상 ${state.targets.length}곳 · ${last ? `${last.result} ${last.regions}곳 · 다시 고르기 ${last.reselectMeters}m${last.error ? ` (${last.error})` : ''}` : '등록 전'} · 머묾 ${Object.values(state.stays).filter((s) => s.exitedAt === null).length}곳 · 보냄 ${state.sent.length}${pending}${lastEvent ? ` · 신호 ${lastEvent.kind} ${state.targets.find((t) => t.id === lastEvent.id)?.name ?? lastEvent.id}` : ''} · ${schedule}`,
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

  // 휴대폰 설정에서 권한을 바꾸고 돌아오면 점검표를 다시 읽는다.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh()
    })
    return () => sub.remove()
  }, [refresh])

  // 제휴 시트의 안내 줄에서 넘어오면 창을 연다.
  useEffect(() => {
    if (openSignal > 0) setModalVisible(true)
  }, [openSignal])

  if (!nearbyAlertsAvailable() || status !== 'authenticated' || !accessToken) return null

  const enabled = settings?.enabled === true
  const source: NearbySource = { partners, campusPoints: buildings, serverEnabled: data?.nearbyAlertsEnabled === true }
  const serverPaused = !data?.nearbyAlertsEnabled && !NEARBY_FIELD_TEST
  const missing = missingItems(checklist)

  const turnOff = async () => {
    setBusy(true)
    await disableNearbyAlerts()
    // 수신 거부를 서버 기록에도 남긴다. 실패해도 기기에서는 이미 꺼졌다(다음에 켤 때 다시 동의를 받는다).
    if (!NEARBY_FIELD_TEST) patchNotificationSettings({ partnerAdConsent: false }, accessToken).catch(() => {})
    await refresh()
    setBusy(false)
  }

  const description = unsupported
    ? '이 휴대폰은 위치 영역 알림(지오펜스)을 지원하지 않아 근처 알림이 오지 않아요.'
    : serverPaused
      ? '지금은 운영진이 근처 알림을 잠시 멈췄어요.'
      : !enabled
        ? '제휴 가게에 머물면 받을 수 있는 혜택을 알려 드려요.'
        : missing.length > 0
          ? `알림이 오려면 설정이 필요해요: ${missing.join(', ')}. 눌러서 고칠 수 있어요.`
          : `${affiliationLabel(settings?.affiliations ?? [])} 제휴 가게에 ${settings?.dwellMinutes?.other ?? DEFAULT_DWELL_MINUTES.other}분(카페는 ${settings?.dwellMinutes?.cafe ?? DEFAULT_DWELL_MINUTES.cafe}분) 넘게 머물면 알려 드려요.`

  return (
    <>
      <ListRow
        icon="navigate-outline"
        label="근처 제휴 알림"
        description={debugLine ? `${description}\n${debugLine}` : description}
        value={enabled && missing.length > 0 ? '확인 필요' : undefined}
        onPress={() => setModalVisible(true)}
        last
        right={
          <ToggleSwitch
            value={enabled}
            onToggle={() => (enabled ? void turnOff() : setModalVisible(true))}
            locked={busy}
            accessibilityLabel={`근처 제휴 알림 ${enabled ? '켜짐' : '꺼짐'}`}
          />
        }
      />
      <NearbyAlertModal
        visible={modalVisible}
        settings={settings}
        checklist={checklist}
        serverPaused={serverPaused}
        onClose={() => setModalVisible(false)}
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

type Step =
  | { kind: 'form' }
  | { kind: 'working'; message: string }
  /** 시스템 권한 창을 띄우기 전, 왜 "항상 허용"이 필요한지와 위치를 가져가지 않는다는 안내(전체 화면). */
  | { kind: 'explain' }
  | { kind: 'needsAlways' }
  | { kind: 'error'; message: string; openSettings?: boolean }

interface ModalProps {
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

function NearbyAlertModal({ visible, settings, checklist, serverPaused, accessToken, onClose, onResync, onRefresh, onTurnOff }: ModalProps) {
  const alreadyOn = settings?.enabled === true
  const [affiliations, setAffiliations] = useState<PartnerAffiliation[]>(settings?.affiliations ?? [])
  const [consent, setConsent] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const [radius, setRadius] = useState(partnerRadiusMeters())
  const [unlimited, setUnlimited] = useState(fieldTestUnlimited())
  const [testNote, setTestNote] = useState<string | null>(null)

  // 창이 열릴 때만 처음 상태로 되돌린다. 켜는 도중 설정이 바뀌어도 안내·오류 문구를 지우지 않게(10-28 테스트).
  useEffect(() => {
    if (!visible) return
    setAffiliations(settings?.affiliations ?? [])
    setConsent(false)
    setStep({ kind: 'form' })
    setRadius(partnerRadiusMeters())
    setUnlimited(fieldTestUnlimited())
    setTestNote(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const finish = useCallback(async () => {
    setStep({ kind: 'working', message: '근처 제휴 업체를 등록하는 중이에요' })
    // 현장 테스트 빌드(TestFlight 내부)는 서버에 동의 필드가 없어도 돌게 기기에만 남긴다.
    if (!NEARBY_FIELD_TEST && !alreadyOn) {
      try {
        // 동의 시각을 서버에 남긴다(수신 동의 기록). 이 필드를 모르는 서버면 켜지 않는다.
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
    // 새로 켤 때는 밤에 쉬는 기본값으로 — 끄면서 서버의 야간 동의 기록도 지워졌다(수신 동의 철회와 함께).
    if (!alreadyOn) await setNearbyPrefs({ quietNight: true })
    const watching = await onResync(affiliations, true)
    if (!watching) {
      setStep({ kind: 'error', message: '켜 두었어요. 지금은 위치를 확인하지 못해, 앱을 다시 열면 근처 업체를 등록해요.' })
      return
    }
    setStep({ kind: 'form' })
    if (!alreadyOn) onClose()
  }, [accessToken, affiliations, alreadyOn, onClose, onResync])

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

  // 이미 "항상 허용"이면 안내 화면 없이 바로, 아니면 안내 화면부터(시스템 창은 안내에서 "계속"을 눌러야 뜬다).
  const begin = async () => {
    if ((await getNearbyPermission()).status === 'granted') void start()
    else setStep({ kind: 'explain' })
  }

  /** 켜져 있을 때 바꾸면 바로 저장하고 다시 등록한다. */
  const run = async (message: string, job: () => Promise<unknown>) => {
    setStep({ kind: 'working', message })
    try {
      await job()
    } finally {
      await onRefresh()
      setStep({ kind: 'form' })
    }
  }

  /**
   * 밤에도 받기 = 야간 수신 별도 동의. 켤 때는 서버에 동의 시각을 먼저 남기고(실패하면 켜지 않는다), 끌 때는 기기에서 먼저 끄고
   * 서버 기록을 지운다. 현장 테스트 빌드는 서버 없이 기기에만.
   */
  const toggleNight = async (allow: boolean) => {
    if (!allow) {
      await run('저장하는 중이에요', async () => {
        await setNearbyPrefs({ quietNight: true })
        if (!NEARBY_FIELD_TEST) await patchNotificationSettings({ partnerAdNightConsent: false }, accessToken).catch(() => {})
      })
      return
    }
    let saved = NEARBY_FIELD_TEST
    await run('저장하는 중이에요', async () => {
      if (!NEARBY_FIELD_TEST) {
        try {
          const res = await patchNotificationSettings({ partnerAdNightConsent: true }, accessToken)
          saved = Boolean(res.partnerAdNightConsentAt)
        } catch {
          saved = false
        }
      }
      if (saved) await setNearbyPrefs({ quietNight: false })
    })
    if (!saved) setStep({ kind: 'error', message: '야간 수신 동의를 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.' })
  }

  /** 소속은 여러 개 고를 수 있다(11-01 — 복수전공·학생회 겸직 등). 누르면 넣고 빼기. */
  const toggleAffiliation = (item: PartnerAffiliation) => {
    const next = affiliations.includes(item) ? affiliations.filter((a) => a !== item) : [...affiliations, item]
    setAffiliations(next)
    if (alreadyOn) void run('소속에 맞춰 다시 등록하는 중이에요', () => onResync(next, false))
  }

  // 테스트 빌드: 반경을 바꾸면 켜져 있을 때 바로 다시 등록한다.
  const chooseRadius = (meters: number) => {
    setRadius(meters)
    void run(`반경 ${meters}m 로 다시 등록하는 중이에요`, async () => {
      await setPartnerRadius(meters === ALERT_RADIUS_METERS ? null : meters)
      if (alreadyOn) await onResync(affiliations, false)
    })
  }

  const toggleUnlimited = () => {
    const next = !unlimited
    setUnlimited(next)
    void run('저장하는 중이에요', async () => {
      await setFieldTestUnlimited(next)
      if (alreadyOn) await onResync(affiliations, false)
    })
  }

  const sendTest = async (group: boolean) => {
    setTestNote('보내는 중…')
    setTestNote(await sendNearbyTestAlert(5, group))
  }

  // 점검표의 "고치기": 알림은 다시 묻고(거절했으면 설정 화면), 위치 "항상"은 안내 화면, 정확한 위치는 설정 화면.
  const fixNotifications = async () => {
    const result = await requestNotificationPermission()
    if (result.status !== 'granted') Linking.openSettings().catch(() => {})
    await onRefresh()
  }

  const muted = settings?.muted ?? []
  const dwell = settings?.dwellMinutes ?? DEFAULT_DWELL_MINUTES
  const working = step.kind === 'working'

  return (
    <SwipeBackModal visible={visible} onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ModalHeader title="근처 제휴 알림" onClose={onClose} />
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, layoutStyles.readable]}>
            {alreadyOn ? (
              <>
                <Text style={styles.sectionTitle}>알림이 오려면</Text>
                <View style={styles.card}>
                  <CheckRow ok={checklist?.notifications === true} label="알림 허용" fixLabel="허용하기" onFix={() => void fixNotifications()} />
                  <CheckRow
                    ok={checklist?.always === true}
                    label={'위치 "항상 허용"'}
                    hint="앱을 닫아 둬도 가게에 머무는 걸 알아채려면 필요해요."
                    fixLabel="고치기"
                    onFix={() => setStep({ kind: 'needsAlways' })}
                  />
                  {checklist?.precise !== null && checklist?.precise !== undefined && (
                    <CheckRow
                      ok={checklist.precise}
                      label="정확한 위치"
                      hint="대략적인 위치로는 어느 가게에 있는지 알 수 없어요."
                      fixLabel="설정 열기"
                      onFix={() => Linking.openSettings().catch(() => {})}
                    />
                  )}
                  <CheckRow ok={!serverPaused} label="근처 알림 운영 중" hint={serverPaused ? '운영진이 잠시 멈췄어요. 다시 켜지면 자동으로 알려 드려요.' : undefined} last />
                </View>

              </>
            ) : (
              <>
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>{ALWAYS_ALLOW_NOTICE}</Text>
                </View>
                <View style={styles.card}>
                  {[
                    `제휴 가게 ${radius}m 안에 ${dwell.other}분(카페는 ${dwell.cafe}분) 넘게 머물면 그 가게 혜택을 알려 드려요.`,
                                        '위치는 휴대폰 안에서 근처 업체를 찾는 데만 쓰고, 서버로 보내거나 저장하지 않아요.',
                    '가게가 붙어 있으면 옆 가게 알림이 갈 수 있고, 일부 휴대폰에서는 늦거나 오지 않을 수 있어요.',
                  ].map((line) => (
                    <View key={line} style={styles.bulletRow}>
                      <Text style={styles.bullet}>·</Text>
                      <Text style={styles.bulletText}>{line}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* 받는 방법은 켜기 전에도 고를 수 있게(11-01 — 켠 뒤에만 보여 머무는 시간 선택을 찾을 수 없었다). */}
            <Text style={styles.sectionTitle}>받는 방법</Text>
            <View style={styles.card}>
              <Text style={styles.hint}>
                {SHOW_DEVELOPER_TOOLS && unlimited
                  ? '테스트 앱은 지금 횟수 제한 없이 보내요(아래 [테스트]에서 바꿀 수 있어요).'
                  : `같은 가게는 하루 1번, 하루 최대 ${MAX_ALERTS_PER_DAY}번, 알림 사이는 30분 넘게 띄워요.`}
              </Text>
              <View style={styles.divider} />
              <Text style={styles.settingLabel}>알림까지 머무는 시간</Text>
              <DwellStepper
                label="카페"
                value={dwell.cafe}
                disabled={working}
                onChange={(cafe) => void run('저장하는 중이에요', () => setNearbyPrefs({ dwellMinutes: { ...dwell, cafe } }))}
              />
              <DwellStepper
                label="그 밖의 가게"
                value={dwell.other}
                disabled={working}
                onChange={(other) => void run('저장하는 중이에요', () => setNearbyPrefs({ dwellMinutes: { ...dwell, other } }))}
              />
              {(dwell.cafe !== DEFAULT_DWELL_MINUTES.cafe || dwell.other !== DEFAULT_DWELL_MINUTES.other) && (
                <Pressable
                  onPress={() => void run('저장하는 중이에요', () => setNearbyPrefs({ dwellMinutes: null }))}
                  disabled={working}
                  hitSlop={6}
                  accessibilityRole="button"
                >
                  <Text style={styles.resetText}>
                    기본값으로 되돌리기(카페 {DEFAULT_DWELL_MINUTES.cafe}분, 그 밖 {DEFAULT_DWELL_MINUTES.other}분)
                  </Text>
                </Pressable>
              )}
              <Text style={styles.hint}>짧게 하면 가게 앞을 지나가기만 해도 올 수 있어요.</Text>
              <View style={styles.divider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{NIGHT_LABEL}</Text>
                  <Text style={styles.hint}>{NIGHT_HINT}</Text>
                </View>
                <ToggleSwitch
                  value={settings?.quietNight === false}
                  onToggle={() => void toggleNight(settings?.quietNight !== false)}
                  locked={working}
                  accessibilityLabel={`${NIGHT_LABEL}, 야간 수신 동의`}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>내 소속(선택, 여러 개 가능)</Text>
            <Text style={styles.hint}>
              {NEARBY_FIELD_TEST
                ? '테스트 앱은 소속과 상관없이 모든 제휴를 알려 드려요(다른 소속 제휴는 알림에 소속이 붙어요).'
                : '고른 소속들과 총학생회 제휴 업체만 알려 드려요. 고르지 않으면 총학생회 제휴만.'}
            </Text>
            <View style={styles.chips}>
              {PARTNER_AFFILIATIONS.filter((item) => item !== '총학생회').map((item) => {
                const selected = affiliations.includes(item)
                return (
                  <Pressable
                    key={item}
                    onPress={() => toggleAffiliation(item)}
                    disabled={working}
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

            {alreadyOn && (
              <>
                <Text style={styles.sectionTitle}>알림 안 받는 가게</Text>
                <View style={styles.card}>
                  {muted.length === 0 ? (
                    <Text style={styles.hint}>없어요. 알림을 길게 누르면 나오는 "이 가게 알림 끄기"로 더할 수 있어요.</Text>
                  ) : (
                    muted.map((item, index) => (
                      <View key={item.id} style={[styles.settingRow, index < muted.length - 1 && styles.rowDivider]}>
                        <Text style={[styles.settingLabel, styles.settingText]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Button
                          label="다시 받기"
                          variant="outline"
                          size="sm"
                          onPress={() => void run('저장하는 중이에요', () => unmuteNearbyPartner(item.id))}
                          disabled={working}
                        />
                      </View>
                    ))
                  )}
                </View>

                <View style={[styles.card, styles.privacyCard]}>
                  <View style={styles.privacyHead}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.settingLabel}>위치는 휴대폰 안에서만 써요</Text>
                  </View>
                  <Text style={styles.hint}>
                    서버로 보내거나 저장하지 않아요. 휴대폰에는 알림을 보낸 가게와 시각만 2일 동안 남아요. 알림을 끈 가게 목록도 이 휴대폰에만 있어요.
                  </Text>
                </View>
              </>
            )}

            {!alreadyOn && (
              <Pressable
                onPress={() => setConsent((v) => !v)}
                style={styles.consentRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                accessibilityLabel="근처 제휴 혜택 알림 받기 동의"
              >
                <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={COLORS.primary} />
                <View style={styles.consentBody}>
                  <Text style={styles.consentTitle}>(필수) 근처 제휴 혜택 알림을 받을게요</Text>
                  <Text style={styles.hint}>
                    제휴 가게에 머물 때 그 가게의 학생 혜택을 알려 드려요(제휴 혜택 알림). 동의하면 동의 여부와 시각만 서버에 남기고, 알림을
                    끄면 바로 지워요. 동의하지 않아도 다른 기능은 그대로 쓸 수 있어요. 밤 {QUIET_START_HOUR}시~아침 {QUIET_END_HOUR}시에는
                    따로 켜야 받아요.
                  </Text>
                </View>
              </Pressable>
            )}

            {SHOW_DEVELOPER_TOOLS && (
              <>
                <Text style={styles.sectionTitle}>[테스트] 테스트 앱에서만 보여요</Text>
                <View style={styles.card}>
                  <Text style={styles.settingLabel}>알림 반경</Text>
                  <View style={styles.chips}>
                    {TEST_RADIUS_OPTIONS.map((meters) => {
                      const selected = radius === meters
                      return (
                        <Pressable
                          key={meters}
                          onPress={() => chooseRadius(meters)}
                          disabled={working}
                          style={[styles.chip, selected && styles.chipOn]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`알림 반경 ${meters}미터`}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextOn]}>{meters}m</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                  {NEARBY_FIELD_TEST && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.settingRow}>
                        <View style={styles.settingText}>
                          <Text style={styles.settingLabel}>횟수 제한 없이(방문마다)</Text>
                          <Text style={styles.hint}>끄면 운영 앱과 같은 규칙(하루 최대·30분 간격)으로 확인할 수 있어요.</Text>
                        </View>
                        <ToggleSwitch value={unlimited} onToggle={toggleUnlimited} locked={working} accessibilityLabel="횟수 제한 없이" />
                      </View>
                    </>
                  )}
                  {alreadyOn && (
                    <>
                      <View style={styles.divider} />
                      <Text style={styles.settingLabel}>시험 알림(5초 뒤)</Text>
                      <Text style={styles.hint}>
                        걷지 않고 알림 모양·버튼·눌렀을 때 이동을 확인해요. 보낸 기록에는 남지 않아요. 홈 화면으로 나가 기다린 뒤 알림을 길게 눌러 보세요.
                      </Text>
                      <View style={styles.testButtons}>
                        <Button label="가게 한 곳" variant="outline" size="sm" onPress={() => void sendTest(false)} />
                        <Button label="여러 곳 묶음" variant="outline" size="sm" onPress={() => void sendTest(true)} />
                        <Button
                          label="보낸 기록 지우기"
                          variant="ghost"
                          size="sm"
                          onPress={() => void run('지우는 중이에요', () => resetNearbyHistoryForDebug())}
                        />
                      </View>
                      {testNote && <Text style={styles.hint}>{testNote}</Text>}
                    </>
                  )}
                </View>
              </>
            )}

            {working && <Text style={styles.status}>{step.message}</Text>}
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
                  <Button label="알림 끄기" variant="secondary" size="lg" onPress={() => void onTurnOff()} disabled={working} />
                </View>
                <View style={styles.footerItem}>
                  <Button label="완료" size="lg" onPress={onClose} />
                </View>
              </>
            ) : (
              <Button label="근처 제휴 알림 켜기" size="lg" onPress={() => void begin()} disabled={!consent} loading={working} />
            )}
          </View>
          {(step.kind === 'explain' || step.kind === 'needsAlways') && (
            <AlwaysAllowOverlay
              afterSettings={step.kind === 'needsAlways'}
              onContinue={() => void start()}
              onCancel={() => setStep({ kind: 'form' })}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </SwipeBackModal>
  )
}

/** "카페  −  2분  +" 한 줄. 1~10분, 바꾸면 바로 저장한다. */
function DwellStepper({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (minutes: number) => void }) {
  const step = (delta: number) => onChange(Math.min(MAX_DWELL_MINUTES, Math.max(MIN_DWELL_MINUTES, value + delta)))
  return (
    <View
      style={styles.settingRow}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} 알림까지 머무는 시간`}
      accessibilityValue={{ text: `${value}분` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <Text style={[styles.settingLabel, styles.settingText]}>{label}</Text>
      <Pressable
        onPress={() => step(-1)}
        disabled={disabled || value <= MIN_DWELL_MINUTES}
        style={[styles.stepButton, value <= MIN_DWELL_MINUTES && styles.stepButtonOff]}
        hitSlop={6}
      >
        <Ionicons name="remove" size={18} color={COLORS.primary} />
      </Pressable>
      <Text style={styles.stepValue}>{value}분</Text>
      <Pressable
        onPress={() => step(1)}
        disabled={disabled || value >= MAX_DWELL_MINUTES}
        style={[styles.stepButton, value >= MAX_DWELL_MINUTES && styles.stepButtonOff]}
        hitSlop={6}
      >
        <Ionicons name="add" size={18} color={COLORS.primary} />
      </Pressable>
    </View>
  )
}

/** 점검표 한 줄: 됐으면 초록 체크, 아니면 주황 느낌표 + 고치기 버튼. */
function CheckRow({
  ok,
  label,
  hint,
  fixLabel,
  onFix,
  last,
}: {
  ok: boolean
  label: string
  hint?: string
  fixLabel?: string
  onFix?: () => void
  last?: boolean
}) {
  return (
    <View style={[styles.settingRow, !last && styles.rowDivider]} accessible={!onFix || ok} accessibilityLabel={`${label} ${ok ? '됨' : '필요'}`}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'alert-circle'}
        size={20}
        color={ok ? COLORS.success : COLORS.warningIcon}
      />
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        {!ok && hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {!ok && fixLabel && onFix ? <Button label={fixLabel} variant="secondary" size="sm" onPress={onFix} /> : null}
    </View>
  )
}

/** 휴대폰 언어가 한국어인지(시스템 창 글자를 같은 말로 그리려고). 알 수 없으면 한국어. */
function deviceIsKorean(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('ko')
  } catch {
    return true
  }
}

interface PermissionStep {
  /** 그림 위 설명("처음 뜨는 창"). */
  caption: string
  /** 시스템 창 제목(설정 화면 목록이면 null). */
  title: string | null
  options: string[]
  /** 눌러야 할 항목 순번. */
  pick: number
  /** 시스템 창이 아니라 설정 화면의 선택 목록 모양으로 그린다. */
  list?: boolean
}

/**
 * 시스템 권한 창·설정 화면을 그대로 본뜬 그림의 내용. 실제 시스템 창에는 앱이 테두리를 그릴 수 없어(운영체제가 앱 위에 그린다)
 * 미리 같은 모양을 보여 주고 눌러야 할 버튼을 표시한다(10-29 사용자 요청). 글자는 휴대폰 언어(한국어·영어)를 따른다.
 */
function permissionSteps(afterSettings: boolean): PermissionStep[] {
  const ko = deviceIsKorean()
  if (Platform.OS === 'ios') {
    if (afterSettings) {
      return [
        {
          caption: ko ? '휴대폰 설정 > 홍익온 > 위치에서' : '휴대폰 설정 > 홍익온 > 위치(Location)에서',
          title: null,
          options: ko
            ? ['안 함', '다음번에 묻기 또는 공유할 때', '앱을 사용하는 동안', '항상']
            : ['Never', 'Ask Next Time Or When I Share', 'While Using the App', 'Always'],
          pick: 3,
          list: true,
        },
      ]
    }
    return [
      {
        caption: '처음 뜨는 창에서',
        title: ko ? "'홍익온'이(가) 사용자의 위치를 사용하도록 허용하겠습니까?" : "Allow '홍익온' to use your location?",
        options: ko ? ['한 번 허용', '앱을 사용하는 동안 허용', '허용 안 함'] : ['Allow Once', 'Allow While Using App', "Don't Allow"],
        pick: 1,
      },
      {
        caption: '이어서 뜨는 창에서',
        title: ko
          ? "'홍익온'이(가) 앱을 사용하지 않을 때에도 사용자의 위치를 사용하도록 허용하겠습니까?"
          : "Allow '홍익온' to also use your location even when you are not using the app?",
        options: ko ? ['앱을 사용하는 동안만 허용 유지', '항상 허용으로 변경'] : ['Keep Only While Using', 'Change to Always Allow'],
        pick: 1,
      },
    ]
  }
  const settingsList: PermissionStep = {
    caption: afterSettings ? '휴대폰 설정 > 앱 > 홍익온 > 권한 > 위치에서' : '이어서 열리는 설정 화면에서',
    title: null,
    options: ko ? ['항상 허용', '앱 사용 중에만 허용', '매번 확인', '허용 안함'] : ['Allow all the time', 'Allow only while using the app', 'Ask every time', "Don't allow"],
    pick: 0,
    list: true,
  }
  if (afterSettings) return [settingsList]
  return [
    {
      caption: '처음 뜨는 창에서',
      title: ko ? '홍익온에서 기기 위치에 액세스하도록 허용하시겠습니까?' : 'Allow 홍익온 to access this device’s location?',
      options: ko ? ['앱 사용 중에만 허용', '이번만 허용', '허용 안함'] : ['While using the app', 'Only this time', "Don't allow"],
      pick: 0,
    },
    settingsList,
  ]
}

/** 시스템 권한 창(또는 설정 목록) 그림. 눌러야 할 항목에 남색 테두리와 "이걸 눌러요". */
function PermissionMock({ title, options, pick, list }: Omit<PermissionStep, 'caption'>) {
  return (
    <View style={[styles.mockDialog, list && styles.mockList]} accessible accessibilityLabel={`${options[pick]} 을 고르세요`}>
      {title ? <Text style={styles.mockTitle}>{title}</Text> : null}
      {options.map((option, index) => {
        const picked = index === pick
        return (
          <View key={option} style={[list ? styles.mockRow : styles.mockButton, picked && styles.mockPicked]}>
            <Text style={[styles.mockButtonText, list && styles.mockRowText, picked && styles.mockPickedText]}>{option}</Text>
            {list && picked ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
            {picked ? (
              <View style={styles.mockTag} pointerEvents="none">
                <Text style={styles.mockTagText}>이걸 눌러요</Text>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

/**
 * "항상 허용" 안내(시스템 권한 창 전에 띄운다 — Google Play 백그라운드 위치 정책의 "눈에 띄는 고지"이기도 하다).
 * 왜 필요한지, 시스템 창에서 무엇을 고르는지, 위치를 가져가지 않는다는 것을 한 화면에 둔다.
 * `afterSettings`: "앱 사용 중"만 허용하고 돌아온 경우 — 휴대폰 설정에서 바꾸는 길을 안내한다.
 */
function AlwaysAllowOverlay({ afterSettings, onContinue, onCancel }: { afterSettings: boolean; onContinue: () => void; onCancel: () => void }) {
  // 절대 위치라 SafeAreaView 의 여백을 받지 못한다 — 상태 막대·홈 표시줄만큼 직접 띄운다(10-29 시뮬레이터에서 아이콘이 시계와 겹침).
  const insets = useSafeAreaInsets()
  const steps = permissionSteps(afterSettings)
  return (
    <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={[styles.overlayContent, layoutStyles.readable]}>
        <View style={styles.overlayIcon}>
          <Ionicons name="navigate" size={28} color={COLORS.white} />
        </View>
        <Text style={styles.overlayTitle}>위치를 "항상 허용"으로 해 주세요</Text>
        <Text style={styles.overlayBody}>
          앱을 닫아 둬도 제휴 가게에 머무는 걸 알아채려면 위치를 "항상" 쓸 수 있어야 해요. 그래야 가게에 있을 때 바로 혜택을 알려 드릴 수
          있어요. "앱을 사용하는 동안"만 허용하면 앱을 닫았을 때는 알림이 오지 않아요.
        </Text>

        {steps.map((item, index) => (
          <View key={item.caption} style={styles.mockStep}>
            <Text style={styles.mockCaption}>
              {index + 1}. {item.caption}
            </Text>
            <PermissionMock title={item.title} options={item.options} pick={item.pick} list={item.list} />
          </View>
        ))}

        <View style={styles.overlayCard}>
          <View style={styles.privacyHead}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
            <Text style={styles.privacyTitle}>홍익온은 내 위치를 가져가지 않아요</Text>
          </View>
          {[
            '위치는 휴대폰 안에서 가까운 제휴 가게를 찾는 데만 써요.',
            '위치를 서버로 보내거나 저장하지 않아요. 운영진도 볼 수 없어요.',
            `가게 ${PARTNER_REGION_RADIUS_METERS}m 근처에 있을 때만 잠깐 GPS 로 거리를 재고, 멀어지면 바로 꺼요.`,
            '휴대폰에는 알림을 보낸 가게와 시각만 2일 동안 남아 같은 알림이 또 가지 않게 해요.',
            '설정 > 근처 제휴 알림에서 언제든 끌 수 있어요.',
          ].map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.bullet}>·</Text>
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.footer, layoutStyles.readable, styles.overlayFooter]}>
        {afterSettings ? (
          <Button label="휴대폰 설정 열기" size="lg" onPress={() => Linking.openSettings().catch(() => {})} />
        ) : (
          <Button label="계속하기" size="lg" onPress={onContinue} />
        )}
        <Button label={afterSettings ? '나중에 할게요' : '켜지 않을게요'} variant="secondary" size="lg" onPress={onCancel} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, gap: 8 },
  bulletRow: { flexDirection: 'row', gap: 6 },
  bullet: { fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, fontFamily: FONTS.regular },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 22, color: COLORS.textPrimary, fontFamily: FONTS.regular },
  label: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginTop: SPACING.sm },
  hint: { fontSize: 14, lineHeight: 20, fontFamily: FONTS.regular, color: COLORS.textTertiary },
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
  chipText: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.chipText },
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
  consentTitle: { fontSize: 16, lineHeight: 22, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  status: { fontSize: 15, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  notice: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.lg, gap: SPACING.md },
  noticeText: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  footer: { padding: SPACING.lg },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: COLORS.background },
  overlayContent: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: SPACING.lg },
  overlayIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  overlayTitle: { fontSize: 20, lineHeight: 28, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  overlayBody: { fontSize: 15, lineHeight: 23, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  overlayCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, gap: 10 },
  privacyHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mockStep: { gap: 8 },
  mockCaption: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  // iOS 시스템 창처럼: 둥근 회색 판, 알약 모양 버튼.
  mockDialog: { backgroundColor: '#E9E9EE', borderRadius: 22, padding: 14, gap: 8 },
  mockList: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 4, gap: 0 },
  mockTitle: { fontSize: 14, lineHeight: 19, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 4 },
  mockButton: {
    backgroundColor: '#D9D9DF',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mockPicked: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  mockButtonText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  mockRowText: { color: COLORS.textPrimary },
  mockPickedText: { fontFamily: FONTS.bold, color: COLORS.primary },
  mockTag: {
    position: 'absolute',
    top: -11,
    right: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  mockTagText: { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.white },
  privacyTitle: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  overlayFooter: { gap: SPACING.sm },
  sectionTitle: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textSecondary, marginTop: SPACING.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  settingText: { flex: 1, gap: 2 },
  settingLabel: { fontSize: 16, lineHeight: 22, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, paddingBottom: 10 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  privacyCard: { gap: 6 },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
  },
  stepButtonOff: { opacity: 0.35 },
  stepValue: { minWidth: 44, textAlign: 'center', fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  resetText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.primary },
  testButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footerRow: { flexDirection: 'row', gap: SPACING.sm },
  footerItem: { flex: 1 },
})
