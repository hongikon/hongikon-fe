import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking } from 'react-native'
import { requestNotificationPermission } from '../../lib/notificationPermission'
import { patchNotificationSettings } from '../../apis/notificationSettings'
import {
  NEARBY_FIELD_TEST,
  fieldTestUnlimited,
  partnerRadiusMeters,
  setFieldTestUnlimited,
  setPartnerRadius,
} from '../../lib/nearbyPartners/debug'
import {
  getNearbyPermission,
  requestNearbyBackground,
  requestNearbyForeground,
  sendNearbyTestAlert,
  setNearbyPrefs,
  type NearbyPermission,
  type NearbySettings,
} from '../../lib/nearbyPartners/background'
import { ALERT_RADIUS_METERS } from '../../lib/nearbyPartners/rules'
import { showConsentResult } from '../../lib/nearbyPartners/consentNotice'
import { toggleInList } from '../../utils/settings/nearby'
import type { PartnerAffiliation } from '../../types'

export type NearbyStep =
  | { kind: 'form' }
  | { kind: 'working'; message: string }
  /** 시스템 권한 창을 띄우기 전 위치 정보 사용 명시적 공개(무엇을·왜·앱을 쓰지 않을 때에도, 동의/동의하지 않음, 전체 화면). */
  | { kind: 'explain' }
  /** "앱 사용 중"을 허용한 뒤, "항상" 권한 창(Android 는 설정 화면) 전에 무엇을 고르는지 보여 준다. */
  | { kind: 'chooseAlways' }
  /** "항상"을 고르지 않고 돌아왔다 — 휴대폰 설정에서 바꾸는 길을 안내한다. */
  | { kind: 'needsAlways' }
  | { kind: 'error'; message: string; openSettings?: boolean }

interface Options {
  visible: boolean
  settings: NearbySettings | null
  accessToken: string
  onClose: () => void
  /** 소속을 바꾸거나 켤 때 다시 등록한다. 실제로 감시를 시작했으면 true. */
  onResync: (affiliations: PartnerAffiliation[], enable: boolean) => Promise<boolean>
  onRefresh: () => Promise<void>
}

/**
 * 근처 제휴 알림 창의 상태와 동작.
 * - 꺼져 있을 때: 안내·소속·수신 동의 → 알림 권한 → 위치 정보 사용 안내 → 위치 "앱 사용 중" → "항상" 안내 → 감시 시작.
 * - 켜져 있을 때: 바꾸면 바로 저장하고 다시 등록한다(`run`).
 */
export function useNearbyAlertFlow({ visible, settings, accessToken, onClose, onResync, onRefresh }: Options) {
  const alreadyOn = settings?.enabled === true
  const [affiliations, setAffiliations] = useState<PartnerAffiliation[]>(settings?.affiliations ?? [])
  const [consent, setConsent] = useState(false)
  const [step, setStep] = useState<NearbyStep>({ kind: 'form' })
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
    let consentAt: string | null = null
    if (!NEARBY_FIELD_TEST && !alreadyOn) {
      try {
        // 동의 시각을 서버에 남긴다(수신 동의 기록). 이 필드를 모르는 서버면 켜지 않는다.
        const saved = await patchNotificationSettings({ partnerAdConsent: true }, accessToken)
        if (!saved.partnerAdConsentAt) {
          setStep({ kind: 'error', message: '서버가 아직 근처 알림을 지원하지 않아요. 잠시 뒤 다시 시도해 주세요.' })
          return
        }
        consentAt = saved.partnerAdConsentAt
      } catch {
        setStep({ kind: 'error', message: '수신 동의를 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.' })
        return
      }
    }
    // 새로 켤 때는 밤에 쉬는 기본값으로 — 끄면서 서버의 야간 동의 기록도 지워졌다(수신 동의 철회와 함께).
    if (!alreadyOn) await setNearbyPrefs({ quietNight: true })
    const watching = await onResync(affiliations, true)
    // 정보통신망법 제50조 제8항: 수신 동의 처리 결과(전송자·동의 일자·결과)를 알린다.
    if (consentAt) showConsentResult('consent', consentAt)
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

  /** 위치 권한 결과로 다음 단계. `afterForeground`: "앱 사용 중"만 막 허용됐으면 "항상" 고르는 안내로. */
  const afterLocation = (location: NearbyPermission, afterForeground: boolean) => {
    if (location.status === 'granted') {
      void finish()
      return
    }
    if (location.status === 'foregroundOnly') {
      setStep({ kind: afterForeground ? 'chooseAlways' : 'needsAlways' })
      return
    }
    setStep({
      kind: 'error',
      message: '위치 권한이 없어 근처 업체를 알 수 없어요. 휴대폰 설정에서 위치를 "항상 허용"으로 바꿔 주세요.',
      openSettings: true,
    })
  }

  // 위치 정보 사용 안내에서 '동의하고 계속' — 바로 위치 권한 창(다른 창을 끼우지 않는다).
  const agreeLocation = async () => {
    setStep({ kind: 'working', message: '권한을 확인하는 중이에요' })
    afterLocation(await requestNearbyForeground(), true)
  }

  const chooseAlways = async () => {
    setStep({ kind: 'working', message: '권한을 확인하는 중이에요' })
    afterLocation(await requestNearbyBackground(), false)
  }

  /**
   * 켜기: 알림 권한을 먼저 묻고, 그다음 위치 정보 사용 안내 → 위치 권한 창. 11-12 Play 거부 뒤 순서를 바꿨다 — 전에는 안내에서
   * '동의하고 계속'을 누르면 알림 권한 창이 먼저 떠, 위치 안내와 위치 권한 창 사이에 다른 창이 끼었다(정책: 권한 요청 바로 앞에 공개).
   * 이미 "항상 허용"이면 안내 없이 바로 켠다.
   */
  const begin = async () => {
    setStep({ kind: 'working', message: '권한을 확인하는 중이에요' })
    const notification = await requestNotificationPermission()
    if (notification.status !== 'granted') {
      setStep({ kind: 'error', message: '알림 권한이 꺼져 있어 근처 알림을 보낼 수 없어요. 휴대폰 설정에서 알림을 켜 주세요.', openSettings: true })
      return
    }
    if ((await getNearbyPermission()).status === 'granted') void finish()
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
      showConsentResult('nightWithdraw')
      return
    }
    let saved = NEARBY_FIELD_TEST
    let nightAt: string | null = null
    await run('저장하는 중이에요', async () => {
      if (!NEARBY_FIELD_TEST) {
        try {
          const res = await patchNotificationSettings({ partnerAdNightConsent: true }, accessToken)
          saved = Boolean(res.partnerAdNightConsentAt)
          nightAt = res.partnerAdNightConsentAt ?? null
        } catch {
          saved = false
        }
      }
      if (saved) await setNearbyPrefs({ quietNight: false })
    })
    if (!saved) setStep({ kind: 'error', message: '야간 수신 동의를 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.' })
    else showConsentResult('nightConsent', nightAt)
  }

  /** 소속은 여러 개 고를 수 있다(11-01 — 복수전공·학생회 겸직 등). 누르면 넣고 빼기. */
  const toggleAffiliation = (item: PartnerAffiliation) => {
    const next = toggleInList(affiliations, item)
    setAffiliations(next)
    if (alreadyOn) void run('소속에 맞춰 다시 등록하는 중이에요', () => onResync(next, false))
  }

  // 테스트 빌드: 반경을 바꾸면 켜져 있을 때 바로 다시 등록한다.
  const chooseRadius = (meters: number) => {
    setRadius(meters)
    // 모든 사용자가 이 휴대폰의 실제 알림 반경을 고른다(11-11 운영진). 켜져 있으면 바로 다시 등록한다.
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

  return {
    alreadyOn,
    affiliations,
    consent,
    setConsent,
    step,
    setStep,
    radius,
    unlimited,
    testNote,
    working: step.kind === 'working',
    agreeLocation,
    chooseAlways,
    begin,
    run,
    toggleNight,
    toggleAffiliation,
    chooseRadius,
    toggleUnlimited,
    sendTest,
    fixNotifications,
  }
}
