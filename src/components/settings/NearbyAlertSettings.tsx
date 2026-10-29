import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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
import { NEARBY_FIELD_TEST, SHOW_DEVELOPER_TOOLS, partnerRadiusMeters, setPartnerRadius } from '../../lib/nearbyPartners/debug'
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
import { ALERT_RADIUS_METERS, PARTNER_REGION_RADIUS_METERS } from '../../lib/nearbyPartners/rules'

/** 테스트 빌드에서 고를 수 있는 업체 반경(m). */
const TEST_RADIUS_OPTIONS = [20, 30, 50, 100] as const
/** 위치를 "항상 허용"해야 하는 이유 — 켜기 전 안내와 권한이 모자랄 때 같은 말을 쓴다. */
const ALWAYS_ALLOW_NOTICE =
  '위치를 "항상 허용"으로 해 두어야 제휴 가게에 머물 때 바로 알림을 받을 수 있어요. "앱을 사용하는 동안"만 허용하면 앱을 닫았을 때는 알림이 오지 않아요.'
import ListRow from '../common/ListRow'
import Button from '../common/Button'
import ToggleSwitch from './ToggleSwitch'
import ModalHeader from './ModalHeader'
import type { PartnerAffiliation } from '../../types'

/**
 * 설정 > 알림 > "근처 제휴 알림". 근처 알림 빌드(`NEARBY_ALERTS_BUILD=1`)이고 로그인했을 때만 보인다.
 * 켜기: 안내·소속·수신 동의 → "항상 허용" 안내 화면 → 알림 권한 → 위치 "앱 사용 중" → "항상" → 서버에 동의 시각 저장 → 감시 시작.
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
  /** 켜 두었는데 위치가 "항상 허용"이 아니다 — 앱을 닫으면 알림이 오지 않는다. */
  const [needsAlways, setNeedsAlways] = useState(false)

  const refresh = useCallback(async () => {
    const settings = await getNearbySettings()
    setEnabled(settings.enabled)
    setAffiliation(settings.affiliation)
    setUnsupported(nearbyGeofencingUnsupported())
    setNeedsAlways(settings.enabled && (await getNearbyPermission()).status !== 'granted')
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
    : enabled && needsAlways
      ? '위치가 "항상 허용"이 아니라 앱을 닫으면 알림이 오지 않아요. 휴대폰 설정 > 위치에서 "항상 허용"으로 바꿔 주세요.'
    : enabled
      ? `${affiliation ? `${affiliation}·총학생회` : '총학생회'} 제휴 가게에 5분 넘게 머물면 혜택을 알려 드려요.`
      : '제휴 가게에 머물면 받을 수 있는 혜택을 알려 드려요.'

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
  /** 시스템 권한 창을 띄우기 전, 왜 "항상 허용"이 필요한지와 위치를 가져가지 않는다는 안내(전체 화면). */
  | { kind: 'explain' }
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
  const [radius, setRadius] = useState(partnerRadiusMeters())

  // 창이 열릴 때만 처음 상태로 되돌린다. 켜는 도중 alreadyOn 이 바뀌어도 안내·오류 문구를 지우지 않게(10-28 테스트).
  useEffect(() => {
    if (!visible) return
    setAffiliation(initialAffiliation)
    setConsent(alreadyOn)
    setStep({ kind: 'form' })
    setRadius(partnerRadiusMeters())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const finish = useCallback(async () => {
    setStep({ kind: 'working', message: '근처 제휴 업체를 등록하는 중이에요' })
    // 현장 테스트 빌드(TestFlight 내부)는 서버에 동의 필드가 없어도 돌게 기기에만 남긴다.
    if (!NEARBY_FIELD_TEST) {
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

  // 이미 "항상 허용"이면 안내 화면 없이 바로, 아니면 안내 화면부터(시스템 창은 안내에서 "계속"을 눌러야 뜬다).
  const begin = async () => {
    if ((await getNearbyPermission()).status === 'granted') void start()
    else setStep({ kind: 'explain' })
  }

  // 테스트 빌드: 반경을 바꾸면 켜져 있을 때 바로 다시 등록한다.
  const chooseRadius = async (meters: number) => {
    await setPartnerRadius(meters === ALERT_RADIUS_METERS ? null : meters)
    setRadius(meters)
    if (alreadyOn) {
      setStep({ kind: 'working', message: `반경 ${meters}m 로 다시 등록하는 중이에요` })
      await onDone(affiliation)
      setStep({ kind: 'form' })
    }
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
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{ALWAYS_ALLOW_NOTICE}</Text>
            </View>

            <View style={styles.card}>
              {[
                `제휴 가게 ${radius}m 안에 5분 넘게 머물면 그 가게 혜택을 알려 드려요.`,
                '같은 가게는 하루 1번, 하루 최대 3번, 알림 사이는 30분 넘게 띄워요.',
                '위치는 휴대폰 안에서 근처 업체를 찾는 데만 쓰고, 서버로 보내거나 저장하지 않아요.',
                '가게가 붙어 있으면 옆 가게 알림이 갈 수 있고, 일부 휴대폰에서는 늦거나 오지 않을 수 있어요.',
              ].map((line) => (
                <View key={line} style={styles.bulletRow}>
                  <Text style={styles.bullet}>·</Text>
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
            </View>

            {SHOW_DEVELOPER_TOOLS && (
              <>
                <Text style={styles.label}>[테스트] 알림 반경</Text>
                <Text style={styles.hint}>테스트 앱에서만 보여요. 바꾸면 근처 업체를 바로 다시 등록해요.</Text>
                <View style={styles.chips}>
                  {TEST_RADIUS_OPTIONS.map((meters) => {
                    const selected = radius === meters
                    return (
                      <Pressable
                        key={meters}
                        onPress={() => void chooseRadius(meters)}
                        disabled={step.kind === 'working'}
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
              </>
            )}

            <Text style={styles.label}>내 소속(선택)</Text>
            <Text style={styles.hint}>
              {NEARBY_FIELD_TEST
                ? '테스트 앱은 소속과 상관없이 모든 제휴를 알려 드려요(다른 소속 제휴는 알림에 소속이 붙어요).'
                : '고른 소속과 총학생회 제휴 업체만 알려 드려요. 고르지 않으면 총학생회 제휴만.'}
            </Text>
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
                accessibilityLabel="근처 제휴 혜택 알림 받기 동의"
              >
                <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={COLORS.primary} />
                <View style={styles.consentBody}>
                  <Text style={styles.consentTitle}>(필수) 근처 제휴 혜택 알림을 받을게요</Text>
                  <Text style={styles.hint}>제휴 가게에 머물 때 혜택을 알려 드려요. 설정에서 언제든 끌 수 있어요.</Text>
                </View>
              </Pressable>
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
          <View style={[styles.footer, layoutStyles.readable]}>
            {alreadyOn ? (
              <Button label="저장" size="lg" onPress={saveAffiliationOnly} loading={step.kind === 'working'} />
            ) : (
              <Button label="근처 제휴 알림 켜기" size="lg" onPress={() => void begin()} disabled={!consent} loading={step.kind === 'working'} />
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
    </Modal>
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
        <Button label={afterSettings ? '나중에 할게요' : '취소'} variant="secondary" size="lg" onPress={onCancel} />
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
})
