import { Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getNotificationSettings, patchNotificationSettings } from '../../apis/notificationSettings'
import { consentReconfirmNotice, consentResultNotice, parseConsentAt, reconfirmDueAt, type ConsentChange } from './consent'
import { disableNearbyAlerts, getNearbySettings } from './background'
import { NEARBY_FIELD_TEST } from './debug'

/**
 * 광고성 정보 수신 동의 안내를 띄운다(정보통신망법 제50조 제8항·시행령 제62조의3, 11-11 사용자 요청). 문구는 `consent.ts`.
 * 현장 테스트 빌드는 서버에 동의를 남기지 않아 띄우지 않는다.
 */

/** 동의·거부·철회를 처리한 뒤 결과를 알린다. `atIso` 는 서버가 준 동의 시각(없으면 지금). */
export function showConsentResult(change: ConsentChange, atIso?: string | null): void {
  if (NEARBY_FIELD_TEST) return
  const { title, message } = consentResultNotice(change, parseConsentAt(atIso) ?? Date.now())
  Alert.alert(title, message, [{ text: '확인' }])
}

const RECONFIRM_KEY = 'hongikon_nearby_reconfirm_v1'

interface ReconfirmRecord {
  consentAt: number
  noticeAt: number
}

let checking = false

/**
 * 동의한 날부터 2년마다 수신 동의를 다시 확인한다. 앱을 열 때 한 번 부른다(`useNearbyPartnerAlerts`).
 * 이 휴대폰에서 근처 알림이 켜져 있고 서버의 동의 시각으로 2년이 지났을 때만 띄운다. "수신 거부"를 누르면 바로 끄고 결과를 알린다.
 */
export async function checkConsentReconfirm(accessToken: string): Promise<void> {
  if (NEARBY_FIELD_TEST || checking) return
  checking = true
  try {
    if (!(await getNearbySettings()).enabled) return
    const consentAt = parseConsentAt((await getNotificationSettings(accessToken)).partnerAdConsentAt)
    if (consentAt === null) return
    let record: ReconfirmRecord | null = null
    try {
      const raw = await AsyncStorage.getItem(RECONFIRM_KEY)
      record = raw ? (JSON.parse(raw) as ReconfirmRecord) : null
    } catch {
      record = null
    }
    const lastNoticeAt = record && record.consentAt === consentAt ? record.noticeAt : null
    if (reconfirmDueAt(consentAt, Date.now(), lastNoticeAt) === null) return
    const save = () =>
      AsyncStorage.setItem(RECONFIRM_KEY, JSON.stringify({ consentAt, noticeAt: Date.now() } satisfies ReconfirmRecord)).catch(() => {})
    const { title, message } = consentReconfirmNotice(consentAt)
    Alert.alert(title, message, [
      {
        text: '수신 거부',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await save()
            await disableNearbyAlerts()
            await patchNotificationSettings({ partnerAdConsent: false }, accessToken).catch(() => {})
            showConsentResult('withdraw')
          })()
        },
      },
      { text: '계속 받기', onPress: () => void save() },
    ])
  } catch {
    // 서버를 못 읽으면 다음에 앱을 열 때 다시 확인한다.
  } finally {
    checking = false
  }
}
