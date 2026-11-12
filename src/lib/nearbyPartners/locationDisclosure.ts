/**
 * 위치 정보 사용 명시적 공개 문구(Google Play 사용자 데이터 정책 "명시적 공개 및 동의 요건"). 화면과 떼어 둔 순수 함수(테스트용).
 * 띄우는 쪽: 앱 사용 중 위치는 `platform.confirmLocationDisclosure`(창), 근처 제휴 알림(백그라운드 위치)은 `NearbyAlertSettings`(전체 화면).
 *
 * 11-12 두 번째 거절(build #32, 같은 사유) 뒤 정책 항목별로 다시 맞춤:
 * - 휴대폰 언어가 한국어가 아니면 영어로 보여 준다. 심사 기기가 영어였다(증거 캡처의 권한 창 그림이 영어) — 한국어 안내를 읽지 못하면
 *   "어디에 쓰는지 적혀 있지 않다"가 된다. 영어 문장의 뜻은 한국어와 같다.
 * - 안내에는 공개 문장과 동의 버튼만 둔다(정책: 관련 없는 내용과 섞지 않음). 권한 창 사용법 그림은 동의한 뒤 다음 화면에.
 * 위치는 휴대폰 안에서만 쓰고 서버로 보내거나 저장하지 않는다 — 문장도 그대로 적는다(수집이 아니라 액세스).
 */

/** 휴대폰 언어가 한국어인지. 알 수 없으면 한국어. */
export function deviceIsKorean(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('ko')
  } catch {
    return true
  }
}

/** 앱 사용 중 위치를 쓰는 기능(안내 문구가 달라진다). */
export type LocationPurpose = 'nearby' | 'myLocation' | 'route' | 'settings'

const PURPOSE_KO: Record<LocationPurpose, string> = {
  nearby: '지금 있는 곳에서 가까운 제휴 가게를 보여 주기',
  myLocation: '지도에 내 위치를 보여 주기',
  route: '내 위치에서 출발하는 길을 안내하기',
  settings: '지도에 내 위치와 가까운 제휴 가게를 보여 주고 내 위치에서 출발하는 길을 안내하기',
}

const PURPOSE_EN: Record<LocationPurpose, string> = {
  nearby: 'show partner stores near where you are',
  myLocation: 'show your location on the map',
  route: 'give directions starting from your location',
  settings: 'show your location and nearby partner stores on the map, and give directions starting from your location',
}

export interface ForegroundDisclosure {
  title: string
  message: string
  agree: string
  decline: string
}

/** 앱 사용 중 위치 권한 창 바로 앞의 안내 창. */
export function foregroundDisclosure(purpose: LocationPurpose, ko: boolean): ForegroundDisclosure {
  if (ko) {
    return {
      title: '위치 정보 사용 안내',
      message:
        `홍익온은 ${PURPOSE_KO[purpose]} 위해 이 기기의 위치 정보(정확한 위치)에 액세스합니다.\n\n` +
        '앱을 사용하는 동안에만 쓰고, 위치는 휴대폰 안에서만 처리해 서버나 다른 회사로 보내거나 저장하지 않아요. ' +
        '동의하면 휴대폰의 위치 권한 창이 떠요.',
      agree: '동의하고 계속',
      decline: '동의하지 않음',
    }
  }
  return {
    title: 'Use of location data',
    message:
      `홍익온 accesses this device's precise location to ${PURPOSE_EN[purpose]}.\n\n` +
      'Location is used only while you are using the app. It is processed only on this phone and is not sent to our server ' +
      'or any other company, and it is not stored. If you agree, your phone will ask for location permission.',
    agree: 'Agree and continue',
    decline: 'Do not agree',
  }
}

export interface BackgroundDisclosure {
  title: string
  /** 공개 문장(무엇을·어떤 기능에·앱이 닫혀 있을 때에도·광고성 정보). 맨 위에 먼저 보인다. */
  lead: string
  bullets: string[]
  /** 버튼 위 한 줄 — 동의하면 무엇이 뜨는지. */
  next: string
  agree: string
  decline: string
}

/** 근처 제휴 알림을 켤 때 위치 권한 창 바로 앞의 전체 화면 안내. `radiusMeters`: 정확한 거리를 재기 시작하는 가게 둘레. */
export function backgroundDisclosure(ko: boolean, radiusMeters: number): BackgroundDisclosure {
  if (ko) {
    return {
      title: '위치 정보 사용 안내',
      lead:
        '홍익온은 앱이 닫혀 있거나 사용 중이 아닐 때에도, 제휴 가게에 머무는 것을 알아채 그 가게의 학생 혜택 알림(광고성 정보)을 ' +
        '보내기 위해 이 기기의 정확한 위치 정보에 액세스합니다.',
      bullets: [
        '사용하는 정보: 정확한 위치(GPS·Wi-Fi), 앱을 사용하지 않을 때의 위치(백그라운드 위치)',
        '쓰는 곳: 가까운 제휴 가게까지 거리를 재 머문 시간을 세는 데만 써요.',
        '위치는 휴대폰 안에서만 처리하고 서버나 다른 회사로 보내거나 저장하지 않아요.',
        `제휴 가게 ${radiusMeters}m 안에 있을 때만 정확한 거리를 재고, 멀어지면 멈춰요.`,
        '설정 > 근처 제휴 알림에서 언제든 수신 거부할 수 있고, 수신 거부하면 위치를 더 쓰지 않아요.',
      ],
      next: '동의하면 휴대폰의 위치 권한 창이 떠요.',
      agree: '동의하고 계속',
      decline: '동의하지 않음',
    }
  }
  return {
    title: 'Use of location data',
    lead:
      "홍익온 accesses this device's precise location, even when the app is closed or not in use, to detect when you stay at " +
      "a partner store and send you that store's student discount alerts (advertising).",
    bullets: [
      'Data used: precise location (GPS, Wi-Fi) and location while the app is not in use (background location).',
      'Purpose: only to measure the distance to nearby partner stores and how long you stay.',
      'Location is processed only on this phone. It is not sent to our server or any other company, and it is not stored.',
      `Precise distance is measured only within ${radiusMeters} m of a partner store and stops when you move away.`,
      'You can opt out anytime in Settings > 근처 제휴 알림. After you opt out, location is no longer used.',
    ],
    next: 'If you agree, your phone will ask for location permission.',
    agree: 'Agree and continue',
    decline: 'Do not agree',
  }
}
