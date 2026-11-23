import type { NearbyChecklist, NearbySettings } from '../../lib/nearbyPartners/background'
import {
  DEFAULT_DWELL_MINUTES,
  MAX_DWELL_MINUTES,
  MIN_DWELL_MINUTES,
  QUIET_END_HOUR,
  QUIET_START_HOUR,
} from '../../lib/nearbyPartners/rules'
import type { PartnerAffiliation } from '../../types'

/** "밤 9시"처럼 12시간제로 읽는다("밤 21시"는 어색하다). */
export const QUIET_START_LABEL = `밤 ${QUIET_START_HOUR > 12 ? QUIET_START_HOUR - 12 : QUIET_START_HOUR}시`
export const NIGHT_LABEL = `${QUIET_START_LABEL}~아침 ${QUIET_END_HOUR}시에도 받기`
/** 켜면 야간 수신 별도 동의가 된다(정보통신망법 제50조 제3항) — 기본은 꺼짐이라 이 시간엔 오지 않는다. */
export const NIGHT_HINT = `켜면 이 시간에도 제휴 혜택 알림을 받는 데 동의해요. 끄면 ${QUIET_START_LABEL}~아침 ${QUIET_END_HOUR}시에는 보내지 않아요.`

export function affiliationLabel(affiliations: readonly PartnerAffiliation[]): string {
  return [...affiliations, '총학생회'].join('·')
}

/** 알림이 오는 데 빠진 것(설정 줄 안내·점검표). */
export function missingItems(checklist: NearbyChecklist | null): string[] {
  if (!checklist) return []
  const missing: string[] = []
  if (!checklist.notifications) missing.push('알림 허용')
  if (!checklist.always) missing.push('위치 "항상"')
  if (checklist.precise === false) missing.push('정확한 위치')
  return missing
}

interface RowDescriptionInput {
  unsupported: boolean
  serverPaused: boolean
  enabled: boolean
  missing: readonly string[]
  settings: NearbySettings | null
}

/** 설정 > 알림 > '근처 제휴 알림' 줄의 지금 상태 한 줄. */
export function nearbyRowDescription({ unsupported, serverPaused, enabled, missing, settings }: RowDescriptionInput): string {
  return unsupported
    ? '이 휴대폰은 위치 영역 알림(지오펜스)을 지원하지 않아 근처 알림이 오지 않아요.'
    : serverPaused
      ? '지금은 운영진이 근처 알림을 잠시 멈췄어요.'
      : !enabled
        ? '제휴 가게에 머물면 받을 수 있는 혜택을 알려 드려요.'
        : missing.length > 0
          ? `알림이 오려면 설정이 필요해요: ${missing.join(', ')}. 눌러서 고칠 수 있어요.`
          : `${affiliationLabel(settings?.affiliations ?? [])} 제휴 가게에 ${settings?.dwellMinutes?.other ?? DEFAULT_DWELL_MINUTES.other}분(카페는 ${settings?.dwellMinutes?.cafe ?? DEFAULT_DWELL_MINUTES.cafe}분) 넘게 머물면 알려 드려요.`
}

/** 머무는 시간 한 칸 올리고 내리기. 1~10분 밖으로 나가지 않는다. */
export function stepDwell(value: number, delta: number): number {
  return Math.min(MAX_DWELL_MINUTES, Math.max(MIN_DWELL_MINUTES, value + delta))
}

/** 소속은 여러 개 고를 수 있다(11-01 — 복수전공·학생회 겸직 등). 누르면 넣고 빼기. */
export function toggleInList<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((a) => a !== item) : [...list, item]
}

export interface PermissionStep {
  /** 그림 위 설명("이어서 뜨는 창에서"). */
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
 * "앱 사용 중"을 허용한 뒤의 "항상" 단계만 그린다 — 위치 정보 사용 안내 화면에는 넣지 않는다(11-12 Play 거부: 공개와 섞지 않음).
 * `afterSettings`: "항상"을 고르지 않고 돌아온 경우 — 휴대폰 설정의 위치 목록. `ios`: Platform.OS === 'ios'.
 */
export function permissionSteps(afterSettings: boolean, ko: boolean, ios: boolean): PermissionStep[] {
  if (ios) {
    if (afterSettings) {
      return [
        {
          caption: ko ? '휴대폰 설정 > 홍익온 > 위치에서' : 'In Settings > 홍익온 > Location',
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
        caption: ko ? '이어서 뜨는 창에서' : 'In the next prompt',
        title: ko
          ? "'홍익온'이(가) 앱을 사용하지 않을 때에도 사용자의 위치를 사용하도록 허용하겠습니까?"
          : "Allow '홍익온' to also use your location even when you are not using the app?",
        options: ko ? ['앱을 사용하는 동안만 허용 유지', '항상 허용으로 변경'] : ['Keep Only While Using', 'Change to Always Allow'],
        pick: 1,
      },
    ]
  }
  return [
    {
      caption: afterSettings
        ? ko
          ? '휴대폰 설정 > 앱 > 홍익온 > 권한 > 위치에서'
          : 'In Settings > Apps > 홍익온 > Permissions > Location'
        : ko
          ? '이어서 열리는 설정 화면에서'
          : 'On the settings screen that opens next',
      title: null,
      options: ko ? ['항상 허용', '앱 사용 중에만 허용', '항상 확인', '허용 안함'] : ['Allow all the time', 'Allow only while using the app', 'Ask every time', "Don't allow"],
      pick: 0,
      list: true,
    },
  ]
}

/** "항상 허용" 안내 화면의 제목·본문. */
export function alwaysAllowCopy(afterSettings: boolean, ko: boolean, ios: boolean): { title: string; body: string } {
  const title = ko ? '위치를 "항상 허용"으로 바꿔 주세요' : ios ? 'Change location to "Always"' : 'Change location to "Allow all the time"'
  const body = afterSettings
    ? ko
      ? ios
        ? '"앱을 사용하는 동안"만 허용하면 앱을 닫았을 때는 알림이 오지 않아요.'
        : '"앱 사용 중에만 허용"으로 두면 앱을 닫았을 때는 알림이 오지 않아요.'
      : ios
        ? 'With "While Using the App", alerts will not arrive when the app is closed.'
        : 'With "Allow only while using the app", alerts will not arrive when the app is closed.'
    : ko
      ? ios
        ? '근처 제휴 알림은 앱이 닫혀 있을 때에도 위치를 써야 해요. 이어서 뜨는 창에서 아래처럼 골라 주세요.'
        : '근처 제휴 알림은 앱이 닫혀 있을 때에도 위치를 써야 해요. 이어서 열리는 설정 화면에서 아래처럼 골라 주세요.'
      : ios
        ? 'Nearby partner alerts need location even when the app is closed. In the next prompt, choose as shown below.'
        : 'Nearby partner alerts need location even when the app is closed. On the settings screen that opens next, choose as shown below.'
  return { title, body }
}
